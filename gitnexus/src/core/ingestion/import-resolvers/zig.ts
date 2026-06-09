import { SupportedLanguages } from 'gitnexus-shared';
import type { ImportResolverFn } from './types.js';
import { resolveStandard } from './standard.js';

/** Zig: resolve @import() paths with standard single-file suffix resolution. */
export const resolveZigImport: ImportResolverFn = (rawImportPath, filePath, ctx) =>
  resolveStandard(rawImportPath, filePath, ctx, SupportedLanguages.Zig);
