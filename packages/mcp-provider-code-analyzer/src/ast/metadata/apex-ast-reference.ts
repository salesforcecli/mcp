import fs from "node:fs/promises";

export type ApexAstAttribute = {
  name: string;
  type: string;
  description: string;
  inherited_from?: string;
};

export type ApexAstNodeMetadata = {
  name: string;
  description?: string;
  category?: string;
  extends?: string;
  implements?: string[];
  attributes?: ApexAstAttribute[];
};

type ApexAstReference = {
  description?: string;
  source?: string;
  extraction_date?: string;
  total_nodes?: number;
  version?: string;
  note?: string;
  nodes: ApexAstNodeMetadata[];
};

let cachedReference: ApexAstReference | undefined;

async function loadApexAstReference(): Promise<ApexAstReference> {
  if (cachedReference) {
    return cachedReference;
  }
  const fileUrl = new URL("../../data/pmd/apex-ast-reference.json", import.meta.url);
  const raw = await fs.readFile(fileUrl, "utf8");
  cachedReference = JSON.parse(raw) as ApexAstReference;
  return cachedReference;
}

/**
 * Fetch metadata for a set of Apex AST node names.
 * - Preserves input order.
 * - Ignores names that are not found.
 */
export async function getApexAstNodeMetadataByNames(
  nodeNames: string[]
): Promise<ApexAstNodeMetadata[]> {
  const reference = await loadApexAstReference();
  const index = new Map<string, ApexAstNodeMetadata>(
    reference.nodes.map((node) => [node.name.toLowerCase(), node])
  );

  const results: ApexAstNodeMetadata[] = [];
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
