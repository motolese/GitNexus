import type { NodeLabel } from 'gitnexus-shared';
import { SupportedLanguages } from 'gitnexus-shared';
import type {
  ExtractedMethods,
  MethodExtractor,
  MethodExtractorContext,
  MethodInfo,
  ParameterInfo,
} from '../method-types.js';
import type { SyntaxNode } from '../utils/ast-helpers.js';

const CONTAINER_DECLARATION_TYPES: ReadonlySet<string> = new Set([
  'struct_declaration',
  'enum_declaration',
  'union_declaration',
  'opaque_declaration',
]);

const METHOD_NODE_TYPE = 'function_declaration';

function getContainerOwnerName(containerNode: SyntaxNode): string | undefined {
  if (!CONTAINER_DECLARATION_TYPES.has(containerNode.type)) return undefined;

  const parentVar = containerNode.parent;
  if (parentVar?.type === 'variable_declaration') {
    const ownerName = parentVar.namedChildren.find((child) => child.type === 'identifier');
    if (ownerName) return ownerName.text;
  }

  return containerNode.childForFieldName('name')?.text;
}

function extractParameters(node: SyntaxNode): ParameterInfo[] {
  const params = node.childForFieldName('parameters');
  if (!params) return [];

  const result: ParameterInfo[] = [];
  for (let i = 0; i < params.namedChildCount; i++) {
    const param = params.namedChild(i);
    if (!param || param.type !== 'parameter') continue;

    const nameNode = param.childForFieldName('name');
    const typeNode = param.childForFieldName('type');
    result.push({
      name: nameNode?.text ?? '?',
      type: typeNode?.text?.trim() ?? null,
      rawType: typeNode?.text?.trim() ?? null,
      isOptional: false,
      isVariadic: param.text.includes('...'),
    });
  }

  return result;
}

function extractReceiverType(node: SyntaxNode): string | null {
  const params = node.childForFieldName('parameters');
  if (!params) return null;

  const first = params.namedChild(0);
  if (!first || first.type !== 'parameter') return null;

  const nameNode = first.childForFieldName('name');
  if (!nameNode || nameNode.text !== 'self') return null;

  return first.childForFieldName('type')?.text?.trim() ?? null;
}

function isStaticMethod(node: SyntaxNode): boolean {
  const params = node.childForFieldName('parameters');
  if (!params) return true;

  const first = params.namedChild(0);
  if (!first || first.type !== 'parameter') return true;

  const firstName = first.childForFieldName('name');
  return firstName?.text !== 'self';
}

function extractMethodInfo(node: SyntaxNode, context: MethodExtractorContext): MethodInfo | null {
  if (node.type !== METHOD_NODE_TYPE) return null;

  const nameNode = node.childForFieldName('name');
  if (!nameNode) return null;

  const returnType = node.childForFieldName('type')?.text?.trim() ?? null;
  const isPublic = /^\s*pub\b/.test(node.text);

  return {
    name: nameNode.text,
    receiverType: extractReceiverType(node),
    returnType,
    parameters: extractParameters(node),
    visibility: isPublic ? 'public' : 'private',
    isStatic: isStaticMethod(node),
    isAbstract: false,
    isFinal: false,
    annotations: [],
    sourceFile: context.filePath,
    line: node.startPosition.row + 1,
  };
}

const extractFunctionName = (
  node: SyntaxNode,
): { funcName: string | null; label: NodeLabel } | null => {
  if (node.type !== METHOD_NODE_TYPE) return null;

  const funcName = node.childForFieldName('name')?.text ?? null;
  const isMethod = !!node.parent && CONTAINER_DECLARATION_TYPES.has(node.parent.type);
  return { funcName, label: isMethod ? 'Method' : 'Function' };
};

export const zigMethodExtractor: MethodExtractor = {
  language: SupportedLanguages.Zig,

  isTypeDeclaration(node: SyntaxNode): boolean {
    return CONTAINER_DECLARATION_TYPES.has(node.type);
  },

  extract(node: SyntaxNode, context: MethodExtractorContext): ExtractedMethods | null {
    if (!CONTAINER_DECLARATION_TYPES.has(node.type)) return null;

    const ownerName = getContainerOwnerName(node);
    if (!ownerName) return null;

    const methods: MethodInfo[] = [];
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (!child || child.type !== METHOD_NODE_TYPE) continue;
      const info = extractMethodInfo(child, context);
      if (info) methods.push(info);
    }

    return { ownerName, methods };
  },

  extractFromNode(node: SyntaxNode, context: MethodExtractorContext): MethodInfo | null {
    return extractMethodInfo(node, context);
  },

  extractFunctionName,
};
