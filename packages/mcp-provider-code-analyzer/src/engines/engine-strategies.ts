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

Guidelines (PMD/Apex XPath):

- Target the smallest stable ancestor that owns the behavior (e.g., MethodCallExpression).
- Avoid cross-node joins (no current(), no sibling/parent chains, no @Image equality to correlate identifiers).
- Prefer structural signals over string matching (e.g., BinaryExpression[@Op='+'], MethodCallExpression[@FullMethodName='X.Y']).
- Use pragmatic string checks only when needed (LiteralExpression guards for edge cases).
- Use only node names/attributes present in the AST dump and metadata.

Prompt boilerplate:
- Use only node names and attributes seen in the following PMD Apex AST dump. Do not invent attributes. Treat attribute values exactly as they appear.
- Select the top-most behavior node (e.g., MethodCallExpression for Database.query/.countQuery) and match evidence of violation anywhere in its subtree using descendant axes.
- Avoid using current() and identifier equality comparisons (@Image) to correlate nodes. Do not rely on sibling or parent chains that may vary.
- Prefer simple, robust patterns over deep, brittle paths. Allow inline and variable-initialized forms.
- Return only the XPath expression, PMD-compatible, no CDATA or extra text.

Verification checklist:
- Ensure the XPath matches:
  - Inline violation: Database.query('...' + var)
  - Variable-based violation: String q = '...' + var; Database.query(q)
  - Multi-part concatenation chains: 'a' + b + 'c' + d
  - String literal containing '+' that contributes to the query
  - Both Database.query and Database.countQuery
- Ensure the XPath does not depend on variable names or declaration order.
- Prefer descendant:: over absolute paths; avoid hard-coding depths.
- If matching an API, gate on @FullMethodName='Namespace.method' not @Image.

Pattern templates (adapt as needed):
- Method call with subtree evidence:
  //MethodCallExpression[ @FullMethodName='Database.query' or @FullMethodName='Database.countQuery' ][ .//BinaryExpression[@Op='+'] or .//LiteralExpression[@LiteralType='STRING' and contains(@Image, '+')] ]
- Ban System.debug in non-test code:
  //MethodCallExpression[ @FullMethodName='System.debug' ]
- Detect DML in loops:
  //ForStatement | //WhileStatement | //ForEachStatement [.//MethodCallExpression[ @FullMethodName='Database.insert' or @FullMethodName='Database.update' or @FullMethodName='Database.delete' ]]
- Detect hardcoded IDs:
  //LiteralExpression[ @LiteralType='STRING' and matches(@Image, '^[a-zA-Z0-9]{15,18}$') ]

AST-first workflow:
1. Generate a minimal, compiling violating Apex snippet for the scenario.
2. Dump the PMD AST for that snippet.
3. Identify the smallest stable ancestor node to select.
4. Write XPath that:
   - Filters by the ancestor’s discriminant attributes (e.g., @FullMethodName)
   - Uses .// to search for evidence nodes under it (BinaryExpression, LiteralExpression, etc.)
   - Avoids current() and identifier joins
5. Validate the XPath against multiple variants of the snippet.

Acceptance test (must pass):
- Database.query('SELECT Id FROM A WHERE Name = ' + name)
- String q = 'SELECT Id FROM A WHERE Name = ' + name; Database.query(q);
- Database.countQuery('SELECT COUNT() FROM A ' + 'WHERE Type = ' + t);
- String q = 'SELECT ' + 'Id' + ' FROM A'; Database.query(q);
- Must not rely on variable names, current(), or fixed ancestor depths.

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
