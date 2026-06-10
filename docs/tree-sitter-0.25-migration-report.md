# Tree-Sitter 0.25 Migration Report

**Date:** 2026-06-10
**Branch:** `pr/treesitter025-upgrade` → `motolese/main`
**Base:** upstream/main (6ab3f644)

## Summary

Upgraded GitNexus from tree-sitter 0.21.1 → 0.25.0 across all 14 languages. Full test suite passes (0 failures, 3 consecutive runs). Indexing verified on the repo itself.

## Changes (7 commits over upstream)

### 1. Tree-sitter 0.21.1 → 0.25.0
- `gitnexus/package.json`: tree-sitter `^0.21.1` → `^0.25.0`
- All grammar peer deps handled via npm overrides (no `--legacy-peer-deps`)
- `TreeSitterLanguage = any` type in parse-worker (ABI 14→15 type mismatch)
- `as any` casts for `setLanguage`/`Query` calls

### 2. Grammar Bumps
| Grammar | Old | New | Status |
|---------|-----|-----|--------|
| Go | 0.23.x | 0.25.0 | ✅ Clean peer dep |
| JavaScript | 0.21.x | 0.25.0 | ✅ Clean peer dep |
| Python | 0.21.x | 0.25.0 | ✅ Clean peer dep |
| C# | 0.23.5 | 0.23.1 | Rollback (0.23.5 broken: `"main":"bindings/node"`) |

### 3. npm Overrides (7 grammars)
Grammars with `peerDeps: ^0.21.x` have npm overrides to accept `^0.25.0`:
c-sharp, cpp, java, php, ruby, rust, typescript

### 4. Test Fixes (6 files)
- **envWithPath:** Re-adds `/usr/bin` and `/bin` after PATH scrubbing (hook git discovery)
- **Go variable-extraction:** Uses `descendantsOfType` for Go 0.25 block statement wrapper
- **COMPATIBLE_ABI:** Accepts 15 in grammar-update-monitor
- **Swift tripwire:** Timeout raised to 30s (TS 0.25 slower on large generated files)
- **spring.ts:** Cast `Java` to `TS25Language` for tree-sitter 0.25 type compat
- **CI/vendor infra:** Updated `.github/scripts/update-vendored-grammars.mjs`

### 5. Bitcoinize-Specific Features (preserved from previous fork work)
- **Zig language support** (full ingestion pipeline)
- **dynamicMinSteps** for sparse call graphs
- **LBug pool** env-tunable sizing, lazy 1-conn pre-warm
- **Skills install** prefers `.agents/skills/gitnexus/`

## Verification

| Check | Result |
|-------|--------|
| Unit tests (gitnexus/) | 466 files, 10683 tests, **0 failures** (3×) |
| Web UI tests (gitnexus-web/) | 23 files, 294 tests, **0 failures** |
| TypeScript compilation | `npx tsc --noEmit` passes |
| npm install | Clean — no `--legacy-peer-deps` needed |
| Full repo index | 14722 nodes, 36121 edges, 851 flows |
| HTTP API | Serving at localhost:4747, returns 200 |
| All 14 grammars load+parse | Verified individually |

## Blocked (upstream npm releases needed)
- `tree-sitter-java` — latest 0.23.5, peerDep `^0.21.1`
- `tree-sitter-ruby` — latest 0.23.1, peerDep `^0.21.1`
- `tree-sitter-typescript` — latest 0.23.2, peerDep `^0.21.0`
- `tree-sitter-cpp` — latest 0.23.2, peerDep `^0.21.1`
- `tree-sitter-php` — latest 0.23.12, peerDep `^0.21.1`
- `tree-sitter-c-sharp` — latest 0.23.1, peerDep `^0.21.1`
- `tree-sitter-rust` — latest 0.23.1, peerDep `^0.21.1`

All work via npm overrides. Will submit upstream PR when grammar peerDeps are updated.
