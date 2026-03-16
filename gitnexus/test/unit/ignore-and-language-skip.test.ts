import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { shouldIgnorePath, loadUserIgnore, resetUserIgnore } from '../../src/config/ignore-service.js';
import { isLanguageAvailable } from '../../src/core/tree-sitter/parser-loader.js';
import { SupportedLanguages } from '../../src/config/supported-languages.js';

// ============================================================================
// .gitnexusignore support
// ============================================================================

describe('.gitnexusignore', () => {
  let tmpDir: string;

  beforeEach(() => {
    resetUserIgnore();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitnexus-test-'));
  });

  afterEach(() => {
    resetUserIgnore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('respects glob patterns from .gitnexusignore', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitnexusignore'), 'mobile/ios/\nmobile/android/\n');
    loadUserIgnore(tmpDir);

    expect(shouldIgnorePath('mobile/ios/Pods/SomeFramework.swift')).toBe(true);
    expect(shouldIgnorePath('mobile/android/app/build.gradle')).toBe(true);
    expect(shouldIgnorePath('mobile/src/App.tsx')).toBe(false);
  });

  it('supports negation patterns', () => {
    // File-level negation: ignore all .swift but keep Package.swift
    fs.writeFileSync(path.join(tmpDir, '.gitnexusignore'), '*.swift\n!Package.swift\n');
    loadUserIgnore(tmpDir);

    expect(shouldIgnorePath('Sources/AppDelegate.swift')).toBe(true);
    expect(shouldIgnorePath('Package.swift')).toBe(false);
  });

  it('supports wildcard patterns', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitnexusignore'), '*.swift\n*.m\n');
    loadUserIgnore(tmpDir);

    expect(shouldIgnorePath('Sources/AppDelegate.swift')).toBe(true);
    expect(shouldIgnorePath('Sources/main.m')).toBe(true);
    expect(shouldIgnorePath('Sources/main.ts')).toBe(false);
  });

  it('ignores comment lines and blank lines', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitnexusignore'), '# Comment\n\nmobile/ios/\n');
    loadUserIgnore(tmpDir);

    expect(shouldIgnorePath('mobile/ios/AppDelegate.swift')).toBe(true);
    expect(shouldIgnorePath('mobile/src/index.ts')).toBe(false);
  });

  it('works normally when no .gitnexusignore exists', () => {
    loadUserIgnore(tmpDir); // no file — should not throw

    // Default ignore rules still work
    expect(shouldIgnorePath('node_modules/express/index.js')).toBe(true);
    // Source files still pass
    expect(shouldIgnorePath('src/index.ts')).toBe(false);
  });

  it('caches the loaded ignore patterns for same repo (lazy load)', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitnexusignore'), 'secret/\n');
    loadUserIgnore(tmpDir);

    expect(shouldIgnorePath('secret/keys.ts')).toBe(true);

    // Calling again with same path should NOT reload (cached)
    loadUserIgnore(tmpDir);
    expect(shouldIgnorePath('secret/keys.ts')).toBe(true);
  });

  it('reloads patterns when repoPath changes (multi-repo)', () => {
    // First repo ignores "secret/"
    fs.writeFileSync(path.join(tmpDir, '.gitnexusignore'), 'secret/\n');
    loadUserIgnore(tmpDir);
    expect(shouldIgnorePath('secret/keys.ts')).toBe(true);
    expect(shouldIgnorePath('docs/readme.md')).toBe(false);

    // Second repo ignores "docs/" instead
    const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'gitnexus-test2-'));
    try {
      fs.writeFileSync(path.join(tmpDir2, '.gitnexusignore'), 'docs/\n');
      loadUserIgnore(tmpDir2);

      // Second repo's patterns should now be active
      expect(shouldIgnorePath('docs/readme.md')).toBe(true);
      // First repo's patterns should no longer apply
      expect(shouldIgnorePath('secret/keys.ts')).toBe(false);
    } finally {
      fs.rmSync(tmpDir2, { recursive: true, force: true });
    }
  });

  it('resetUserIgnore clears the cache', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitnexusignore'), 'secret/\n');
    loadUserIgnore(tmpDir);
    expect(shouldIgnorePath('secret/keys.ts')).toBe(true);

    resetUserIgnore();
    // After reset, user ignore is cleared — need to reload
    expect(shouldIgnorePath('secret/keys.ts')).toBe(false);
  });
});

// ============================================================================
// Unsupported language graceful skip
// ============================================================================

describe('isLanguageAvailable', () => {
  it('returns true for installed languages', () => {
    expect(isLanguageAvailable(SupportedLanguages.TypeScript)).toBe(true);
    expect(isLanguageAvailable(SupportedLanguages.JavaScript)).toBe(true);
    expect(isLanguageAvailable(SupportedLanguages.Python)).toBe(true);
    expect(isLanguageAvailable(SupportedLanguages.Java)).toBe(true);
    expect(isLanguageAvailable(SupportedLanguages.Go)).toBe(true);
    expect(isLanguageAvailable(SupportedLanguages.Rust)).toBe(true);
    expect(isLanguageAvailable(SupportedLanguages.PHP)).toBe(true);
    expect(isLanguageAvailable(SupportedLanguages.Ruby)).toBe(true);
  });

  it('returns false for fabricated language values', () => {
    expect(isLanguageAvailable('erlang' as SupportedLanguages)).toBe(false);
    expect(isLanguageAvailable('haskell' as SupportedLanguages)).toBe(false);
  });

  it('handles Swift based on optional dependency availability', () => {
    // Swift is optional — result depends on whether tree-sitter-swift is installed
    const result = isLanguageAvailable(SupportedLanguages.Swift);
    expect(typeof result).toBe('boolean');
    // If tree-sitter-swift is not installed, this should be false
    // Either way, it should not throw
  });
});
