import { Worker } from 'node:worker_threads';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface WorkerPool {
  /**
   * Dispatch items across workers. Items are split into chunks (one per worker),
   * each worker processes its chunk via sub-batches to limit peak memory,
   * and results are concatenated back in order.
   */
  dispatch<TInput, TResult>(
    items: TInput[],
    onProgress?: (filesProcessed: number) => void,
  ): Promise<TResult[]>;

  /** Terminate all workers. Must be called when done. */
  terminate(): Promise<void>;

  /** Number of workers in the pool */
  readonly size: number;
}

/** Message shapes sent back by worker threads. */
type WorkerOutgoingMessage =
  | { type: 'progress'; filesProcessed: number }
  | { type: 'sub-batch-done' }
  | { type: 'error'; error: string }
  | { type: 'result'; data: unknown };

/**
 * Default max files to send to a worker in a single postMessage.
 * Keeps structured-clone memory bounded per sub-batch.
 */
const DEFAULT_SUB_BATCH_SIZE = 1500;

/** Default per sub-batch timeout. If a single sub-batch takes longer,
 *  likely a pathological file (e.g. minified 50MB JS). Fail fast.
 *  Can be raised via --batch-timeout for large C++ monorepos (Bitcoin
 *  Core / Knots) where tree-sitter needs >30s per batch. */
const DEFAULT_SUB_BATCH_TIMEOUT_MS = 30_000;

/**
 * Options for {@link createWorkerPool}. All fields are optional — unset
 * fields fall back to safe defaults derived from CPU count / file size.
 */
export interface WorkerPoolOptions {
  /** Number of worker threads. Defaults to min(8, cpus-1). */
  poolSize?: number;
  /** Files per postMessage sub-batch. Defaults to 1500. */
  subBatchSize?: number;
  /** Per sub-batch timeout in ms. Defaults to 30 000 (30 s). */
  subBatchTimeoutMs?: number;
  /** Optional adaptive retry: on timeout, halve sub-batch and retry once. */
  adaptiveRetry?: boolean;
}

/**
 * Create a pool of worker threads.
 */
export const createWorkerPool = (
  workerUrl: URL,
  options?: WorkerPoolOptions | number,
): WorkerPool => {
  // Validate worker script exists before spawning to prevent uncaught
  // MODULE_NOT_FOUND crashes in worker threads (e.g. when running from src/ via vitest)
  const workerPath = fileURLToPath(workerUrl);
  if (!fs.existsSync(workerPath)) {
    throw new Error(`Worker script not found: ${workerPath}`);
  }

  // Back-compat: a bare number was the old poolSize argument.
  const opts: WorkerPoolOptions = typeof options === 'number' ? { poolSize: options } : options ?? {};

  const size = opts.poolSize ?? Math.min(8, Math.max(1, os.cpus().length - 1));
  const initialSubBatchSize = Math.max(1, opts.subBatchSize ?? DEFAULT_SUB_BATCH_SIZE);
  const subBatchTimeoutMs = Math.max(1_000, opts.subBatchTimeoutMs ?? DEFAULT_SUB_BATCH_TIMEOUT_MS);
  const adaptiveRetry = opts.adaptiveRetry ?? true;
  const workers: Worker[] = [];

  for (let i = 0; i < size; i++) {
    workers.push(new Worker(workerUrl));
  }

  const dispatch = <TInput, TResult>(
    items: TInput[],
    onProgress?: (filesProcessed: number) => void,
  ): Promise<TResult[]> => {
    if (items.length === 0) return Promise.resolve([]);

    const chunkSize = Math.ceil(items.length / size);
    const chunks: TInput[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }

    const workerProgress = new Array(chunks.length).fill(0);

    const promises = chunks.map((chunk, i) => {
      const worker = workers[i];
      return new Promise<TResult>((resolve, reject) => {
        let settled = false;
        let subBatchTimer: ReturnType<typeof setTimeout> | null = null;

        const cleanup = () => {
          if (subBatchTimer) clearTimeout(subBatchTimer);
          worker.removeListener('message', handler);
          worker.removeListener('error', errorHandler);
          worker.removeListener('exit', exitHandler);
        };

        // Per-worker sub-batch size — halved on adaptive retry.
        let subBatchSize = initialSubBatchSize;
        // Cursor into the chunk — advances on each sub-batch-done.
        let cursor = 0;
        // Tracks whether the in-flight batch was already retried at half size.
        let lastBatchRetried = false;
        let lastBatchStart = 0;
        let lastBatchLen = 0;

        const resetSubBatchTimer = () => {
          if (subBatchTimer) clearTimeout(subBatchTimer);
          subBatchTimer = setTimeout(() => {
            if (settled) return;
            // Adaptive retry: on the first timeout of a batch, halve the
            // size and retry. Pathological file isolates to a smaller
            // window. If the halved batch ALSO times out, we give up.
            if (adaptiveRetry && !lastBatchRetried && subBatchSize > 1) {
              lastBatchRetried = true;
              subBatchSize = Math.max(1, Math.floor(subBatchSize / 2));
              // Rewind cursor so sendNextSubBatch resends from the same
              // starting file at the new smaller size.
              cursor = lastBatchStart;
              resetSubBatchTimer();
              sendNextSubBatch();
              return;
            }
            settled = true;
            cleanup();
            reject(
              new Error(
                `Worker ${i} sub-batch timed out after ${subBatchTimeoutMs / 1000}s ` +
                  `(batch: ${lastBatchLen} files starting at ${lastBatchStart} of ${chunk.length}).`,
              ),
            );
          }, subBatchTimeoutMs);
        };

        const sendNextSubBatch = () => {
          if (cursor >= chunk.length) {
            worker.postMessage({ type: 'flush' });
            return;
          }
          const subBatch = chunk.slice(cursor, cursor + subBatchSize);
          lastBatchStart = cursor;
          lastBatchLen = subBatch.length;
          lastBatchRetried = false;
          cursor += subBatch.length;
          resetSubBatchTimer();
          worker.postMessage({ type: 'sub-batch', files: subBatch });
        };

        const handler = (msg: WorkerOutgoingMessage) => {
          if (settled) return;
          if (msg.type === 'progress') {
            workerProgress[i] = msg.filesProcessed;
            if (onProgress) {
              const total = workerProgress.reduce((a, b) => a + b, 0);
              onProgress(total);
            }
          } else if (msg.type === 'sub-batch-done') {
            sendNextSubBatch();
          } else if (msg.type === 'error') {
            settled = true;
            cleanup();
            reject(new Error(`Worker ${i} error: ${msg.error}`));
          } else if (msg.type === 'result') {
            settled = true;
            cleanup();
            resolve(msg.data as TResult);
          }
        };

        const errorHandler = (err: Error) => {
          if (!settled) {
            settled = true;
            cleanup();
            reject(err);
          }
        };

        const exitHandler = (code: number) => {
          if (!settled) {
            settled = true;
            cleanup();
            reject(
              new Error(
                `Worker ${i} exited with code ${code}. Likely OOM or native addon failure.`,
              ),
            );
          }
        };

        worker.on('message', handler);
        worker.once('error', errorHandler);
        worker.once('exit', exitHandler);
        sendNextSubBatch();
      });
    });

    return Promise.all(promises);
  };

  const terminate = async (): Promise<void> => {
    await Promise.all(workers.map((w) => w.terminate()));
    workers.length = 0;
  };

  return { dispatch, terminate, size };
};
