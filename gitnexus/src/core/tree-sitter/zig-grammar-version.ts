import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

export type ZigQueryProfile = 'zig-1.0' | 'zig-1.1+';

export interface ZigGrammarRuntimeInfo {
  installedVersion: string | null;
  queryProfile: ZigQueryProfile;
  source: 'detected' | 'override' | 'fallback';
}

const PACKAGE_NAME = '@tree-sitter-grammars/tree-sitter-zig';
const LEGACY_PROFILE: ZigQueryProfile = 'zig-1.0';
const MODERN_PROFILE: ZigQueryProfile = 'zig-1.1+';

const _require = createRequire(import.meta.url);

let cachedRuntime: ZigGrammarRuntimeInfo | null = null;
let warnedForUnexpectedVersion = false;

const parseVersionParts = (version: string | null): { major: number; minor: number } | null => {
  if (!version) return null;
  const [majorRaw, minorRaw] = version.split('.');
  const major = Number.parseInt(majorRaw ?? '', 10);
  const minor = Number.parseInt(minorRaw ?? '', 10);
  if (Number.isNaN(major) || Number.isNaN(minor)) return null;
  return { major, minor };
};

const parseOverrideProfile = (value: string | undefined): ZigQueryProfile | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'zig-1.0' || normalized === '1.0' || normalized === 'legacy') {
    return LEGACY_PROFILE;
  }
  if (normalized === 'zig-1.1+' || normalized === '1.1' || normalized === 'modern') {
    return MODERN_PROFILE;
  }
  return null;
};

export const getZigQueryProfileForVersion = (version: string | null): ZigQueryProfile => {
  const parts = parseVersionParts(version);
  if (!parts) return MODERN_PROFILE;
  if (parts.major === 1 && parts.minor === 0) return LEGACY_PROFILE;
  return MODERN_PROFILE;
};

export const detectInstalledZigGrammarVersion = (): string | null => {
  try {
    const packageJsonPath = _require.resolve(`${PACKAGE_NAME}/package.json`);
    const raw = readFileSync(packageJsonPath, 'utf8');
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === 'string' ? parsed.version : null;
  } catch {
    return null;
  }
};

export const getZigGrammarRuntimeInfo = (): ZigGrammarRuntimeInfo => {
  if (cachedRuntime) return cachedRuntime;

  const overrideProfile = parseOverrideProfile(process.env.GITNEXUS_ZIG_QUERY_PROFILE);
  if (overrideProfile) {
    cachedRuntime = {
      installedVersion: detectInstalledZigGrammarVersion(),
      queryProfile: overrideProfile,
      source: 'override',
    };
    return cachedRuntime;
  }

  const installedVersion = detectInstalledZigGrammarVersion();
  if (!installedVersion) {
    cachedRuntime = {
      installedVersion: null,
      queryProfile: MODERN_PROFILE,
      source: 'fallback',
    };
    return cachedRuntime;
  }

  cachedRuntime = {
    installedVersion,
    queryProfile: getZigQueryProfileForVersion(installedVersion),
    source: 'detected',
  };
  return cachedRuntime;
};

export const warnIfUnexpectedZigGrammarVersion = (context: string): void => {
  if (warnedForUnexpectedVersion) return;
  const runtime = getZigGrammarRuntimeInfo();
  const parts = parseVersionParts(runtime.installedVersion);
  if (!parts || parts.major !== 1) {
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
