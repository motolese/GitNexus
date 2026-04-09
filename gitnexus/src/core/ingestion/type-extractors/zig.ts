import type { SyntaxNode } from '../utils/ast-helpers.js';
import type { LanguageTypeConfig, ParameterExtractor, TypeBindingExtractor } from './types.js';
import { extractSimpleTypeName } from './shared.js';

const DECLARATION_NODE_TYPES: ReadonlySet<string> = new Set(['variable_declaration']);

/**
 * Zig variable declarations may omit explicit types (`const x = ...`).
 * We only bind when the grammar exposes a concrete `type` field to avoid
 * polluting TypeEnv with speculative inference.
 */
const extractDeclaration: TypeBindingExtractor = (
  node: SyntaxNode,
  env: Map<string, string>,
): void => {
  if (node.type !== 'variable_declaration') return;

  const nameNode = node.namedChildren.find((child) => child.type === 'identifier');
  const typeNode = node.childForFieldName('type');
  if (!nameNode || !typeNode) return;

  const typeName = extractSimpleTypeName(typeNode) ?? typeNode.text?.trim();
  if (typeName) env.set(nameNode.text, typeName);
};

/** Zig function parameters are `(parameter name: type)` nodes under `parameters`. */
const extractParameter: ParameterExtractor = (node: SyntaxNode, env: Map<string, string>): void => {
  if (node.type !== 'parameter') return;

  const nameNode = node.childForFieldName('name');
  const typeNode = node.childForFieldName('type');
  if (!nameNode || !typeNode) return;

  const typeName = extractSimpleTypeName(typeNode) ?? typeNode.text?.trim();
  if (typeName) env.set(nameNode.text, typeName);
};

export const typeConfig: LanguageTypeConfig = {
  declarationNodeTypes: DECLARATION_NODE_TYPES,
  extractDeclaration,
  extractParameter,
};
