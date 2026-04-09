import { SupportedLanguages } from 'gitnexus-shared';
import { BaseFieldExtractor } from '../field-extractor.js';
import type {
  ExtractedFields,
  FieldExtractorContext,
  FieldInfo,
  FieldVisibility,
} from '../field-types.js';
import type { SyntaxNode } from '../utils/ast-helpers.js';

const CONTAINER_DECLARATION_TYPES: ReadonlySet<string> = new Set([
  'struct_declaration',
  'enum_declaration',
  'union_declaration',
  'opaque_declaration',
]);

function getContainerOwnerName(containerNode: SyntaxNode): string | undefined {
  if (!CONTAINER_DECLARATION_TYPES.has(containerNode.type)) return undefined;

  const parentVar = containerNode.parent;
  if (parentVar?.type === 'variable_declaration') {
    const ownerName = parentVar.namedChildren.find((child) => child.type === 'identifier');
    if (ownerName) return ownerName.text;
  }

  return containerNode.childForFieldName('name')?.text;
}

function extractFieldType(fieldNode: SyntaxNode): string | null {
  const typeNode = fieldNode.childForFieldName('type');
  return typeNode?.text?.trim() ?? null;
}

export class ZigFieldExtractor extends BaseFieldExtractor {
  language = SupportedLanguages.Zig;

  isTypeDeclaration(node: SyntaxNode): boolean {
    return CONTAINER_DECLARATION_TYPES.has(node.type);
  }

  protected extractVisibility(node: SyntaxNode): FieldVisibility {
    return /^\s*pub\b/.test(node.text) ? 'public' : 'private';
  }

  extract(node: SyntaxNode, context: FieldExtractorContext): ExtractedFields | null {
    if (!this.isTypeDeclaration(node)) return null;

    const ownerFqn = getContainerOwnerName(node);
    if (!ownerFqn) return null;

    const fields: FieldInfo[] = [];
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (!child || child.type !== 'container_field') continue;

      const nameNode = child.childForFieldName('name');
      if (!nameNode) continue;

      let type = extractFieldType(child);
      if (type) {
        type = this.normalizeType(type);
        const resolved = this.resolveType(type, context);
        type = resolved ?? type;
      }

      fields.push({
        name: nameNode.text,
        type,
        visibility: this.extractVisibility(child),
        isStatic: false,
        isReadonly: true,
        sourceFile: context.filePath,
        line: child.startPosition.row + 1,
      });
    }

    return { ownerFqn, fields, nestedTypes: [] };
  }
}

export const zigFieldExtractor = new ZigFieldExtractor();
