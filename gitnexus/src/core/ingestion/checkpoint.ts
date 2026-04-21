/**
 * Analyze checkpoint utility — F-1.2 worker-pool / resumable indexing.
 *
 * A checkpoint is an append-only JSONL log at `<storage>/analyze-checkpoint.jsonl`.
 * Every successfully-processed file path gets one line `{"path":"..."}`. On a
 * crashed or timed-out analyze, the next `--resume` run reads this file,
 * builds a Set, and filters already-processed paths out of the scan list.
 *
 * Design notes:
 * - Append-only: a partial write on crash still leaves a valid prefix the
 *   next run can parse. Garbage lines are skipped.
 * - No fsync per write: the batch granularity matches the worker-pool
 *   sub-batch so we lose at most one sub-batch of progress on crash.
 * - Lives under `.gitnexus/` so `gitnexus clean` wipes it alongside other
 *   per-repo state.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export const CHECKPOINT_FILE = 'analyze-checkpoint.jsonl';

/** Load the set of completed file paths from a prior crashed analyze. */
export async function loadCheckpointSet(storagePath: string): Promise<Set<string>> {
  const out = new Set<string>();
  const file = path.join(storagePath, CHECKPOINT_FILE);
  if (!fs.existsSync(file)) return out;
  const contents = await fs.promises.readFile(file, 'utf8');
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed);
      if (typeof row.path === 'string') out.add(row.path);
    } catch {
      // Skip garbage lines from a partial write.
    }
  }
  return out;
}

/** Append one batch of completed file paths to the checkpoint log. */
export async function appendCheckpointBatch(
  storagePath: string,
  paths: readonly string[],
): Promise<void> {
  if (paths.length === 0) return;
  const file = path.join(storagePath, CHECKPOINT_FILE);
  // Ensure storage dir exists — runScanAndStructure may have created it,
  // but we don't assume.
  await fs.promises.mkdir(storagePath, { recursive: true });
  const body = paths.map((p) => JSON.stringify({ path: p })).join('\n') + '\n';
  await fs.promises.appendFile(file, body, 'utf8');
}

/** Remove the checkpoint file — called on successful end-of-pipeline so
 *  the next clean analyze starts fresh. */
export async function clearCheckpoint(storagePath: string): Promise<void> {
  const file = path.join(storagePath, CHECKPOINT_FILE);
  try {
    await fs.promises.unlink(file);
  } catch {
    // Already gone — fine.
  }
}
