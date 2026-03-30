// DEPRECATED: Use pmd-ast-reference.ts instead.
// This file is kept for backward compatibility only.

import { getAstNodeMetadataByNames, type AstNodeMetadata } from "./pmd-ast-reference.js";

/**
 * @deprecated Use getAstNodeMetadataByNames('apex', nodeNames) instead
 * Fetch metadata for a set of Apex AST node names.
 * - Preserves input order.
 * - Ignores names that are not found.
 */
export async function getApexAstNodeMetadataByNames(
  nodeNames: string[]
): Promise<AstNodeMetadata[]> {
  return getAstNodeMetadataByNames('apex', nodeNames);
}
