import { createRequire } from 'node:module';
import Parser from 'tree-sitter';
import { afterEach, describe, expect, it } from 'vitest';
import {
  __resetZigGrammarRuntimeCacheForTests,
  detectInstalledZigGrammarVersion,
  getZigGrammarRuntimeInfo,
  getZigQueryProfileForVersion,
} from '../../src/core/tree-sitter/zig-grammar-version.js';
import { getZigQueriesForProfile, getZigQueriesForRuntime } from '../../src/core/ingestion/tree-sitter-queries.js';

const _require = createRequire(import.meta.url);
const ZIG = _require('@tree-sitter-grammars/tree-sitter-zig');

const SAMPLE_ZIG = `
const std = @import("std");
const module = @import("module.zig");

const Kind = enum {
    a,
    b,
    pub fn label(self: Kind) []const u8 {
        _ = self;
        return "ok";
    }
};

const Value = union(enum) {
    a: i32,
    b: bool,
    pub fn tagName(self: Value) []const u8 {
        return @tagName(self);
    }
};

const Point = struct {
    x: i32,
    y: i32,
    pub fn norm(self: Point) i32 {
        return self.x;
    }
};
`;

describe('zig grammar compatibility', () => {
  afterEach(() => {
    delete process.env.GITNEXUS_ZIG_QUERY_PROFILE;
    __resetZigGrammarRuntimeCacheForTests();
  });

  it('maps parser versions to compatibility profiles', () => {
    expect(getZigQueryProfileForVersion('1.0.2')).toBe('zig-1.0');
    expect(getZigQueryProfileForVersion('1.1.2')).toBe('zig-1.1+');
    expect(getZigQueryProfileForVersion('2.0.0')).toBe('zig-1.1+');
  });

  it('detects installed Zig grammar and picks matching runtime profile', () => {
    const detected = detectInstalledZigGrammarVersion();
    const runtime = getZigGrammarRuntimeInfo();

    expect(runtime.installedVersion).toBe(detected);
    expect(runtime.queryProfile).toBe(getZigQueryProfileForVersion(detected));
  });

  it('supports explicit profile override for legacy grammars', () => {
    process.env.GITNEXUS_ZIG_QUERY_PROFILE = 'legacy';
    __resetZigGrammarRuntimeCacheForTests();
    const runtime = getZigGrammarRuntimeInfo();
    expect(runtime.source).toBe('override');
    expect(runtime.queryProfile).toBe('zig-1.0');
  });

  it('runtime-selected Zig query compiles and captures key symbols', () => {
    const parser = new Parser();
    parser.setLanguage(ZIG);
    const tree = parser.parse(SAMPLE_ZIG);
    const QueryCtor = (Parser as any).Query;
    const query = new QueryCtor(ZIG, getZigQueriesForRuntime());
    const captures = query.captures(tree.rootNode);
    const names = captures.map((capture: { name: string }) => capture.name);

    expect(names).toContain('definition.struct');
    expect(names).toContain('definition.enum');
    expect(names).toContain('definition.union');
    expect(names).toContain('definition.method');
    expect(names).toContain('definition.property');
    expect(names).toContain('import');
  });

  it('both profile query variants contain Zig container and import captures', () => {
    for (const profile of ['zig-1.0', 'zig-1.1+'] as const) {
      const query = getZigQueriesForProfile(profile);
      expect(query).toContain('@definition.struct');
      expect(query).toContain('@definition.enum');
      expect(query).toContain('@definition.union');
      expect(query).toContain('@import.source');
    }
  });
});
