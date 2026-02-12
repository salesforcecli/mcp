import { generateAstXmlFromSource } from "../ast/generate-ast-xml.js";
import { type AstNode, extractAstNodesFromXml } from "../ast/extract-ast-nodes.js";
import { getApexAstNodeMetadataByNames, type ApexAstNodeMetadata } from "../ast/metadata/apex-ast-reference.js";
import { LANGUAGE_NAMES } from "../constants.js";

export type GetAstNodesInput = {
  code: string;
  language: string;
};

export type GetAstNodesOutput = {
  status: string;
  nodes: AstNode[];
  metadata: ApexAstNodeMetadata[];
};

export interface GetAstNodesAction {
  exec(input: GetAstNodesInput): Promise<GetAstNodesOutput>;
}

export class GetAstNodesActionImpl implements GetAstNodesAction {
  public async exec(input: GetAstNodesInput): Promise<GetAstNodesOutput> {
    try {
      // Steps:
      // 1) Generate AST XML from source code
      // 2) Parse XML into AST nodes
      // 3) Resolve cached metadata for unique node names (per language)
      // TODO: Spike note:
      // - Currently shelling out to the PMD CLI (`./pmd ast-dump`) to generate AST XML.
      // - This is a temporary approach for early prototyping and should not be considered final.
      // - Replace this with a direct PMD Java API integration or a Code Analyzer core API call.
      // - When replacing, remove dependency on local PMD bin path and avoid spawning external processes.
      const astXml = await generateAstXmlFromSource(input.code, input.language);
      const nodes = extractAstNodesFromXml(astXml);
      const language = input.language?.toLowerCase().trim();
      const nodeNames = Array.from(new Set(nodes.map((node) => node.nodeName)));
      const metadata = await getCachedMetadataByLanguage(language, nodeNames);
      return { status: "success", nodes, metadata };
    } catch (e) {
      return { status: (e as Error)?.message ?? String(e), nodes: [], metadata: [] };
    }
  }
}

async function getCachedMetadataByLanguage(
  language: string,
  nodeNames: string[]
): Promise<ApexAstNodeMetadata[]> {
  const normalized = (language ?? "").toLowerCase().trim();
  if (normalized === LANGUAGE_NAMES.Apex) {
    return getApexAstNodeMetadataByNames(nodeNames);
  }
  return [];
}

