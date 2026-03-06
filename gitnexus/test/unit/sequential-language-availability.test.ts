import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../src/core/tree-sitter/parser-loader.js', () => ({
  loadParser: vi.fn(async () => ({
    parse: vi.fn(),
    getLanguage: vi.fn(),
  })),
  loadLanguage: vi.fn(async () => undefined),
  isLanguageAvailable: vi.fn(() => true),
}));

import { createKnowledgeGraph } from '../../src/core/graph/graph.js';
import { createASTCache } from '../../src/core/ingestion/ast-cache.js';
import { createImportMap, processImports } from '../../src/core/ingestion/import-processor.js';
import { processCalls } from '../../src/core/ingestion/call-processor.js';
import { processHeritage } from '../../src/core/ingestion/heritage-processor.js';
import { createSymbolTable } from '../../src/core/ingestion/symbol-table.js';
import * as parserLoader from '../../src/core/tree-sitter/parser-loader.js';


describe('sequential native parser availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips Swift files in processImports when the native parser is unavailable', async () => {
    vi.mocked(parserLoader.isLanguageAvailable).mockReturnValue(false);

    await expect(processImports(
      createKnowledgeGraph(),
      [{ path: 'App.swift', content: 'import Foundation' }],
      createASTCache(),
      createImportMap(),
      undefined,
      '/tmp/repo',
      ['App.swift'],
    )).resolves.toBeUndefined();

    expect(parserLoader.loadLanguage).not.toHaveBeenCalled();
  });

  it('skips Swift files in processCalls when the native parser is unavailable', async () => {
    vi.mocked(parserLoader.isLanguageAvailable).mockReturnValue(false);

    await expect(processCalls(
      createKnowledgeGraph(),
      [{ path: 'App.swift', content: 'func demo() {}' }],
      createASTCache(),
      createSymbolTable(),
      createImportMap(),
    )).resolves.toBeUndefined();

    expect(parserLoader.loadLanguage).not.toHaveBeenCalled();
  });

  it('skips Swift files in processHeritage when the native parser is unavailable', async () => {
    vi.mocked(parserLoader.isLanguageAvailable).mockReturnValue(false);

    await expect(processHeritage(
      createKnowledgeGraph(),
      [{ path: 'App.swift', content: 'class AppViewController: UIViewController {}' }],
      createASTCache(),
      createSymbolTable(),
    )).resolves.toBeUndefined();

    expect(parserLoader.loadLanguage).not.toHaveBeenCalled();
  });
});
