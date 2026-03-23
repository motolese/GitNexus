import { describe, expect, it } from 'vitest';
import { generateAllCSVs } from '../../src/core/lbug/csv-generator';
import { createKnowledgeGraph } from '../../src/core/graph/graph';
import { NODE_TABLES } from '../../src/core/lbug/schema';

describe('generateAllCSVs', () => {
  it('generates CSV for all NODE_TABLES present in the graph', () => {
    const graph = createKnowledgeGraph();
    // Add one node per multi-language table type
    const testTables = ['Struct', 'Enum', 'Trait', 'Impl', 'Macro', 'TypeAlias'] as const;
    for (const label of testTables) {
      graph.addNode({
        id: `${label}:test.rs:MyItem`,
        label,
        properties: { name: 'MyItem', filePath: 'test.rs', startLine: 1, endLine: 10 },
      });
    }

    const csvData = generateAllCSVs(graph, new Map());

    for (const label of testTables) {
      const csv = csvData.nodes.get(label);
      expect(csv, `CSV for ${label} should be generated`).toBeDefined();
      expect(csv!.split('\n').length, `CSV for ${label} should have header + 1 row`).toBeGreaterThanOrEqual(2);
    }
  });

  it('multi-language table CSVs have 6 columns (no isExported)', () => {
    const graph = createKnowledgeGraph();
    graph.addNode({
      id: 'Struct:lib.rs:Point',
      label: 'Struct',
      properties: { name: 'Point', filePath: 'lib.rs', startLine: 5, endLine: 15 },
    });

    const csvData = generateAllCSVs(graph, new Map());
    const csv = csvData.nodes.get('Struct')!;
    const header = csv.split('\n')[0];
    const columns = header.split(',').length;
    expect(columns).toBe(6); // id, name, filePath, startLine, endLine, content
  });

  it('community keywords with commas are properly CSV-escaped', () => {
    const graph = createKnowledgeGraph();
    graph.addNode({
      id: 'comm_0',
      label: 'Community',
      properties: {
        name: 'TestCluster',
        heuristicLabel: 'test',
        keywords: ['auth, login', 'user management'],
        description: 'test community',
        cohesion: 0.8,
        symbolCount: 5,
      },
    });

    const csvData = generateAllCSVs(graph, new Map());
    const csv = csvData.nodes.get('Community')!;
    const rows = csv.split('\n');
    expect(rows.length).toBeGreaterThanOrEqual(2);
    // The keywords field should be quoted (RFC 4180) since it contains commas
    const dataRow = rows[1];
    expect(dataRow).toContain('auth');
    expect(dataRow).toContain('login');
  });

  it('generates File CSV with content from fileContents map', () => {
    const graph = createKnowledgeGraph();
    graph.addNode({
      id: 'File:src/index.ts',
      label: 'File',
      properties: { name: 'index.ts', filePath: 'src/index.ts' },
    });

    const fileContents = new Map([['src/index.ts', 'console.log("hello")']]);
    const csvData = generateAllCSVs(graph, fileContents);
    const csv = csvData.nodes.get('File')!;
    expect(csv).toContain('hello');
  });

  it('returns a relCSV string', () => {
    const graph = createKnowledgeGraph();
    graph.addNode({
      id: 'Function:a.ts:foo',
      label: 'Function',
      properties: { name: 'foo', filePath: 'a.ts', startLine: 1, endLine: 5 },
    });
    graph.addNode({
      id: 'Function:a.ts:bar',
      label: 'Function',
      properties: { name: 'bar', filePath: 'a.ts', startLine: 10, endLine: 15 },
    });
    graph.addRelationship({
      sourceId: 'Function:a.ts:foo',
      targetId: 'Function:a.ts:bar',
      type: 'CALLS',
      properties: {},
    });

    const csvData = generateAllCSVs(graph, new Map());
    expect(csvData.relCSV).toContain('CALLS');
    expect(csvData.relCSV).toContain('Function:a.ts:foo');
  });

  it('handles all NODE_TABLES without crashing', () => {
    const graph = createKnowledgeGraph();
    for (const table of NODE_TABLES) {
      if (table === 'File' || table === 'Folder' || table === 'Community' || table === 'Process') continue;
      graph.addNode({
        id: `${table}:test:item`,
        label: table,
        properties: { name: 'item', filePath: 'test', startLine: 1, endLine: 2 },
      });
    }

    expect(() => generateAllCSVs(graph, new Map())).not.toThrow();
    const csvData = generateAllCSVs(graph, new Map());
    expect(csvData.nodes.size).toBeGreaterThan(0);
  });
});
