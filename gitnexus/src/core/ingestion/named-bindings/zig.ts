import type { SyntaxNode } from '../utils/ast-helpers.js';
import type { NamedBinding } from './types.js';

/**
 * Zig imports are typically module aliases:
 *   const std = @import("std");
 *   const foo = @import("./foo.zig");
 *
 * We emit these as module aliases so import processing can populate
 * moduleAliasMap (`std`/`foo` -> resolved file path).
 */
export function extractZigNamedBindings(importNode: SyntaxNode): NamedBinding[] | undefined {
  if (importNode.type !== 'variable_declaration') return undefined;

  const aliasNode = importNode.namedChildren.find((child) => child.type === 'identifier');
  const builtinCall = importNode.namedChildren.find((child) => child.type === 'builtin_function');
  if (!aliasNode || !builtinCall) return undefined;

  const builtinIdentifier = builtinCall.namedChildren.find((child) => child.type === 'builtin_identifier');
  if (!builtinIdentifier || builtinIdentifier.text !== '@import') return undefined;

  return [{ local: aliasNode.text, exported: aliasNode.text, isModuleAlias: true }];
}
