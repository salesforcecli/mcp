import fs from "node:fs/promises";

// Generic PMD AST node metadata loader for all languages.
export type AstAttribute = {
  name: string;
  type: string;
  description: string;
  inherited_from?: string;
};

export type AstNodeMetadata = {
  name: string;
  description?: string;
  category?: string;
  extends?: string;
  implements?: string[];
  attributes?: AstAttribute[];
};

type AstReference = {
  description?: string;
  source?: string;
  extraction_date?: string;
  total_nodes?: number;
  version?: string;
  note?: string;
  nodes: AstNodeMetadata[];
};

// Cache references per language to avoid repeated file reads
const cachedReferences = new Map<string, AstReference>();

async function loadAstReference(language: string): Promise<AstReference> {
  const normalizedLanguage = language.toLowerCase().trim();

  if (cachedReferences.has(normalizedLanguage)) {
    return cachedReferences.get(normalizedLanguage)!;
  }

  const fileUrl = new URL(`../../data/pmd/${normalizedLanguage}-ast-reference.json`, import.meta.url);
  const raw = await fs.readFile(fileUrl, "utf8");
  const reference = JSON.parse(raw) as AstReference;

  cachedReferences.set(normalizedLanguage, reference);
  return reference;
}

/**
 * Fetch metadata for a set of AST node names for any PMD-supported language.
 * - Preserves input order.
 * - Ignores names that are not found.
 * @param language - Programming language (e.g., 'apex', 'html', 'javascript', 'visualforce')
 * @param nodeNames - Array of node names to fetch metadata for
 * @returns Array of AST node metadata in the same order as input
 */
export async function getAstNodeMetadataByNames(
  language: string,
  nodeNames: string[]
): Promise<AstNodeMetadata[]> {
  const reference = await loadAstReference(language);
  const index = new Map<string, AstNodeMetadata>(
    reference.nodes.map((node) => [node.name.toLowerCase(), node])
  );

  const results: AstNodeMetadata[] = [];
  for (const name of nodeNames) {
    const normalized = name.toLowerCase();
    let node = index.get(normalized);
    if (!node) {
      node = reference.nodes.find((candidate) =>
        (candidate.implements ?? []).some((iface) =>
          iface.toLowerCase().includes(`<${normalized}>`)
        )
      );
    }
    if (node) {
      results.push(node);
    }
  }
  return results;
}
