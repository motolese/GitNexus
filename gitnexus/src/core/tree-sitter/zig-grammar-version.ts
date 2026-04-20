// Thin adapter — source of truth now lives in the grammar package.
// See: @tree-sitter-grammars/tree-sitter-zig/profile (bindings/node/profile.js)
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);
const profile = _require('@tree-sitter-grammars/tree-sitter-zig/profile') as {
  LEGACY_PROFILE: 'zig-1.0';
  MODERN_PROFILE: 'zig-1.1+';
  resolveQueryProfile: (options?: { envVar?: string }) => {
    installedVersion: string | null;
    queryProfile: 'zig-1.0' | 'zig-1.1+';
    source: 'detected' | 'override' | 'fallback';
  };
  getQueryProfileForVersion: (version: string | null) => 'zig-1.0' | 'zig-1.1+';
  detectInstalledVersion: () => string | null;
};

const PACKAGE_NAME = '@tree-sitter-grammars/tree-sitter-zig';
const ENV_VAR = 'GITNEXUS_ZIG_QUERY_PROFILE';

export type ZigQueryProfile = 'zig-1.0' | 'zig-1.1+';

export interface ZigGrammarRuntimeInfo {
  installedVersion: string | null;
  queryProfile: ZigQueryProfile;
  source: 'detected' | 'override' | 'fallback';
}

let cachedRuntime: ZigGrammarRuntimeInfo | null = null;
let warnedForUnexpectedVersion = false;

export const getZigQueryProfileForVersion = (version: string | null): ZigQueryProfile =>
  profile.getQueryProfileForVersion(version);

export const detectInstalledZigGrammarVersion = (): string | null => profile.detectInstalledVersion();

export const getZigGrammarRuntimeInfo = (): ZigGrammarRuntimeInfo => {
  if (cachedRuntime) return cachedRuntime;
  cachedRuntime = profile.resolveQueryProfile({ envVar: ENV_VAR });
  return cachedRuntime;
};

export const warnIfUnexpectedZigGrammarVersion = (context: string): void => {
  if (warnedForUnexpectedVersion) return;
  const runtime = getZigGrammarRuntimeInfo();
  const [majorRaw] = (runtime.installedVersion ?? '').split('.');
  const major = Number.parseInt(majorRaw ?? '', 10);
  if (Number.isNaN(major) || major !== 1) {
    warnedForUnexpectedVersion = true;
    console.warn(
      `[GitNexus] ${context}: detected ${PACKAGE_NAME}@${runtime.installedVersion ?? 'unknown'}; using ${runtime.queryProfile} compatibility profile.`,
    );
  }
};

export const __resetZigGrammarRuntimeCacheForTests = (): void => {
  cachedRuntime = null;
  warnedForUnexpectedVersion = false;
};
