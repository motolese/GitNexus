# GitNexus Zig Support - Custom Implementation

## Objective
Restore end-to-end Zig ingestion so GitNexus can:
- detect Zig files
- parse Zig AST without silent failure
- extract symbols, imports, calls, methods, and properties
- resolve owner relationships (`HAS_METHOD` / `HAS_PROPERTY`) correctly
- surface MCP graph query failures instead of masking them

## Reality Check on Dependency Drift
The originally requested grammar target (`@tree-sitter-grammars/tree-sitter-zig@^1.1.2`) conflicts with the current GitNexus parser stack (`tree-sitter@0.21.x`) and fails installation/resolution without forcing legacy peer handling or a broader parser-stack upgrade.

Custom compatibility decision in this implementation:
- Use `@tree-sitter-grammars/tree-sitter-zig@1.0.2` (compatible with `tree-sitter@0.21.x`) for stable runtime parsing.
- Keep a forked `tree-sitter-zig` branch prepared for peer-range alignment work (`motolese/tree-sitter-zig`, branch `fix/zig-grammar-alignment`), but do not wire it as the active runtime dependency in GitNexus.

## Pipeline Fixes Implemented

### 1) Language Registration and Detection
- Added `SupportedLanguages.Zig` to shared language enum.
- Added `.zig` extension detection and syntax mapping.

Files:
- `gitnexus-shared/src/languages.ts`
- `gitnexus-shared/src/language-detection.ts`

### 2) Parser Availability (Main + Worker)
- Added Zig grammar loading in:
  - main parser loader
  - parse worker parser map

Files:
- `gitnexus/src/core/tree-sitter/parser-loader.ts`
- `gitnexus/src/core/ingestion/workers/parse-worker.ts`

### 3) Correct Zig Tree-sitter Queries
Added `ZIG_QUERIES` and wired into `LANGUAGE_QUERIES` with corrected shapes:
- type declarations from `variable_declaration` (`const Name = struct/enum/union/opaque`)
- method captures inside container declarations
- property captures as `@definition.property` + `@name` from `container_field`
- import capture from Zig builtin `@import`
- call captures for identifier and member calls

File:
- `gitnexus/src/core/ingestion/tree-sitter-queries.ts`

### 4) Non-minimal Zig Language Provider
Implemented full Zig provider with:
- dedicated type extractor
- dedicated named-binding extractor for module aliases
- dedicated import resolver
- dedicated field extractor
- dedicated method extractor
- class extractor wiring
- builtin/noise filter
- namespace import semantics

Files:
- `gitnexus/src/core/ingestion/languages/zig.ts`
- `gitnexus/src/core/ingestion/type-extractors/zig.ts`
- `gitnexus/src/core/ingestion/named-bindings/zig.ts`
- `gitnexus/src/core/ingestion/import-resolvers/zig.ts`
- `gitnexus/src/core/ingestion/field-extractors/zig.ts`
- `gitnexus/src/core/ingestion/method-extractors/zig.ts`
- `gitnexus/src/core/ingestion/languages/index.ts`
- `gitnexus/src/core/ingestion/import-resolvers/utils.ts` (added `.zig` extension support)

### 5) Owner Resolution Fix (`findEnclosingClassInfo`)
Patched enclosing container resolution for Zig nameless container nodes by deriving owner name from parent `variable_declaration` identifier.

Also added container support for:
- `union_declaration`
- `opaque_declaration`

File:
- `gitnexus/src/core/ingestion/utils/ast-helpers.ts`

### 6) MCP Failure Surfacing (No Silent Empty Arrays)
Updated MCP backend methods to log and throw explicit errors instead of returning empty arrays on failures:
- `queryClusters`
- `queryProcesses`

File:
- `gitnexus/src/mcp/local/local-backend.ts`

### 7) Framework and Entry-point Exhaustiveness
Added Zig entries to exhaustive language maps to keep compile-time language coverage valid.

Files:
- `gitnexus/src/core/ingestion/framework-detection.ts`
- `gitnexus/src/core/ingestion/entry-point-scoring.ts`

### 8) Dependency Wiring
Added Zig grammar dependency compatible with the current parser ABI:
- `@tree-sitter-grammars/tree-sitter-zig@1.0.2`

Files:
- `gitnexus/package.json`
- `gitnexus/package-lock.json`

## Test and Fixture Coverage Added

Updated/added tests to verify Zig availability and extraction:
- parser loading
- language detection
- query shape assertions
- query compilation smoke tests
- multi-language parsing integration
- `HAS_METHOD` owner resolution integration

Added Zig fixture:
- `gitnexus/test/fixtures/sample-code/simple.zig`

Updated files:
- `gitnexus/test/unit/parser-loader.test.ts`
- `gitnexus/test/unit/ingestion-utils.test.ts`
- `gitnexus/test/unit/tree-sitter-queries.test.ts`
- `gitnexus/test/integration/query-compilation.test.ts`
- `gitnexus/test/integration/tree-sitter-languages.test.ts`
- `gitnexus/test/integration/has-method.test.ts`

## Validation Run
Executed successfully:
- `npx tsc --noEmit`
- `npx vitest run test/unit/parser-loader.test.ts test/unit/ingestion-utils.test.ts test/unit/tree-sitter-queries.test.ts test/unit/framework-detection.test.ts test/unit/entry-point-scoring.test.ts test/unit/resources.test.ts test/integration/tree-sitter-languages.test.ts test/integration/has-method.test.ts test/integration/query-compilation.test.ts`

Result:
- all selected tests passed
- Zig parsing, query compilation, and owner linkage behavior validated

## Forks and Branches
- GitNexus fork: `motolese/GitNexus`
  - branch: `fix/zig-pipeline-complete`
- tree-sitter-zig fork: `motolese/tree-sitter-zig`
  - branch: `fix/zig-grammar-alignment`
  - change: relaxed peer dependency range to support `tree-sitter@0.21.x || 0.22.x`

## PR Strategy
1. PR 1 (GitNexus): Zig ingestion pipeline implementation and tests.
2. PR 2 (tree-sitter-zig, optional/upstreaming path): peer-range compatibility discussion for broader installation stability.

