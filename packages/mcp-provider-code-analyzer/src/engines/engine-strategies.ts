import { generateAstXmlFromSource } from "../ast/generate-ast-xml.js";
import { type AstNode } from "../ast/extract-ast-nodes.js";
import { getApexAstNodeMetadataByNames, type ApexAstNodeMetadata } from "../ast/metadata/apex-ast-reference.js";
import { LANGUAGE_NAMES } from "../constants.js";

export type EngineName = "pmd";

export type PromptInput = {
  language: string;
  engine: string;
  astNodes: AstNode[];
  astMetadata: ApexAstNodeMetadata[];
};

export interface AstGenerator {
  generateAstXml(code: string, language: string): Promise<string>;
}

export interface AstMetadataProvider {
  getMetadata(language: string, nodeNames: string[]): Promise<ApexAstNodeMetadata[]>;
}

export interface PromptBuilder {
  buildPrompt(input: PromptInput): string;
}

export type EngineStrategy = {
  engine: EngineName;
  astGenerator: AstGenerator;
  metadataProvider: AstMetadataProvider;
  promptBuilder: PromptBuilder;
};

class PmdAstGenerator implements AstGenerator {
  public async generateAstXml(code: string, language: string): Promise<string> {
    return generateAstXmlFromSource(code, language);
  }
}

class PmdAstMetadataProvider implements AstMetadataProvider {
  public async getMetadata(language: string, nodeNames: string[]): Promise<ApexAstNodeMetadata[]> {
    const normalized = (language ?? "").toLowerCase().trim();
    if (normalized === LANGUAGE_NAMES.Apex) {
      return getApexAstNodeMetadataByNames(nodeNames);
    }
    return [];
  }
}

class PmdPromptBuilder implements PromptBuilder {
  public buildPrompt(input: PromptInput): string {
    const nodeSummaries = buildNodeSummaries(input.astNodes, input.astMetadata);
    return `You are generating a PMD XPath query.
Goal: Generate an XPath expression that matches the violation described earlier.

Context:

Engine: ${input.engine}

Language: ${input.language}

AST nodes (from ast-dump) with extracted metadata:
${JSON.stringify(nodeSummaries, null, 2)}

Task:

Use the AST nodes and metadata above to write a precise XPath for the violation.

Create the XPath for the scenario described by the user request.

Prefer minimal, stable XPath that avoids overfitting.

Return only the XPath expression.

Requirements:

Review availableNodes (${nodeSummaries.length} nodes) to identify needed nodes.

Use ONLY node names from availableNodes.

Use only attributes present in the AST metadata.

Treat attribute values exactly as shown in metadata (e.g., if @Image includes quotes, do not strip them).

Do not invent attributes or assume normalization.

Prefer structural matching over string manipulation.

Avoid complex XPath functions unless clearly required.

Ensure compatibility with PMD ${input.engine} XPath support.

Next step:

Call the tool 'create_custom_rule' with the generated XPath to create the custom rule.`;
  }
}

const PMD_STRATEGY: EngineStrategy = {
  engine: "pmd",
  astGenerator: new PmdAstGenerator(),
  metadataProvider: new PmdAstMetadataProvider(),
  promptBuilder: new PmdPromptBuilder()
};

export function getEngineStrategy(engine: string): EngineStrategy {
  const normalized = (engine ?? "").toLowerCase().trim();
  if (normalized === "pmd") {
    return PMD_STRATEGY;
  }
  throw new Error(`engine '${engine}' is not supported yet`);
}

function buildNodeSummaries(
  nodes: AstNode[],
  metadata: ApexAstNodeMetadata[]
): Array<{
  nodeName: string;
  parent: string | null;
  ancestors: string[];
  attributes: Record<string, string>;
  metadata: ApexAstNodeMetadata | null;
}> {
  const metadataByName = new Map(
    metadata.map((node) => [node.name.toLowerCase(), node])
  );
  return nodes.map((node) => {
    const nodeMetadata = metadataByName.get(node.nodeName.toLowerCase());
    return {
      nodeName: node.nodeName,
      parent: node.parent ?? null,
      ancestors: node.ancestors,
      attributes: node.attributes,
      metadata: nodeMetadata ?? null
    };
  });
}
