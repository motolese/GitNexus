# bitcoinize-gitnexus — Bitcoinize Fork of GitNexus

**Upstream:** https://github.com/abhigyanpatwari/GitNexus
**Fork maintainer:** Fernando Motolese <fernando@produlz.com>
**Fork base:** v1.5.3 (dc86ea9)

## Why the Fork

bitcoinize-ai is 325 Zig files / 106K lines. Upstream GitNexus has no Zig support.
We added first-class Zig indexing, plus several infrastructure improvements needed
for our internal code-intelligence loop.

## What We Added (vs upstream v1.5.3)

| Area | Files | Purpose |
|------|-------|---------|
| **Zig language support** | `src/core/ingestion/{languages,field-extractors,method-extractors,type-extractors,named-bindings,import-resolvers}/zig.ts` | Parse Zig AST, extract symbols, resolve imports across the Zig stdlib |
| **tree-sitter-zig grammar version detection** | `src/core/tree-sitter/zig-grammar-version.ts` | Multi-version Zig grammar compatibility (0.14/0.15/0.16) |
| **Class extractors module** | `src/core/ingestion/class-extractors/` + `class-types.ts` | Refactored class/struct handling for polyglot support |
| **Heritage map** | `src/core/ingestion/heritage-map.ts` | Inheritance tracking across languages |
| **Group CLI** | `src/cli/group.ts` + `src/core/group/` | Repo grouping for multi-project workspaces |
| **Git staleness detector** | `src/core/git-staleness.ts` | Detect stale index vs live git state |
| **tree-sitter 0.25.0 upgrade** | `package.json` | ABI 15 support (required by modern tree-sitter-zig grammar) |

## Tree-sitter Dependency Chain

```
gitnexus (this fork) → tree-sitter@0.25.0 (npm)
                    → @tree-sitter-grammars/tree-sitter-zig → file:/data/projects/tree-sitter-zig-fix (our fork)
                                                             → upstream: motolese/tree-sitter-zig (branch: fix/zig-grammar-alignment)
```

## Upstream Sync Policy

- **Base branch:** `main` (matches upstream main)
- **Work branch:** `bitcoinize/zig-support`
- **Sync cadence:** after each upstream minor release (1.6.x → 1.7.x)
- **Merge strategy:** `git merge upstream/<tag>` — resolve conflicts in our Zig files and `package.json`

## Runtime Integration

- Symlinked to `/usr/lib/node_modules/gitnexus` → `/data/projects/bitcoinize-gitnexus`
- Binary: `/usr/bin/gitnexus` → `../lib/node_modules/gitnexus/dist/cli/index.js`
- MCP server wired in `.mcp.json` as `gitnexus` (command: `/usr/bin/gitnexus mcp`)
