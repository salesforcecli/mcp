// DEPRECATED: Use pmd-ast-reference.ts instead.
// This file is kept for backward compatibility only.

import { getAstNodeMetadataByNames, type AstNodeMetadata, type AstAttribute } from "./pmd-ast-reference.js";

// Type aliases for backward compatibility
export type ApexAstAttribute = AstAttribute;
export type ApexAstNodeMetadata = AstNodeMetadata;

/**
 * @deprecated Use getAstNodeMetadataByNames('apex', nodeNames) instead
 * Fetch metadata for a set of Apex AST node names.
 * - Preserves input order.
 * - Ignores names that are not found.
 */
export async function getApexAstNodeMetadataByNames(
  nodeNames: string[]
): Promise<ApexAstNodeMetadata[]> {
  return getAstNodeMetadataByNames('apex', nodeNames);
}
