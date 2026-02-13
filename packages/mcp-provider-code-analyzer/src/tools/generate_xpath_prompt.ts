import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, TelemetryService, Toolset } from "@salesforce/mcp-provider-api";
import * as Constants from "../constants.js";
import { GetAstNodesActionImpl, type GetAstNodesAction, type GetAstNodesInput, type GetAstNodesOutput } from "../actions/get-ast-nodes.js";

// Builds the prompt that guides XPath authoring from AST context.
const DESCRIPTION: string =
  `Purpose: First step for creating a PMD XPath-based custom rule.
  Use this tool when the user asks to create a custom rule (especially PMD/XPath).
  
  Inputs (required):
  - sampleCode: A short snippet that SHOULD violate the intended rule.
    - Ensure this snippet truly triggers the exact pattern you want to catch.
    - Keep it minimal yet self-contained (parsable/compilable); remove unrelated noise.
    - Prefer realistic code over contrived examples to avoid brittle XPath.
  - language: Programming language of sampleCode (e.g., "apex", "xml").
  - engine: Analysis engine (e.g., "pmd").
  
  Output:
  - prompt: A concise, high-signal prompt that guides an LLM to extract the AST context needed for XPath authoring from the sampleCode.
  
  Use this tool when the user asks for rules like:
  - Ban all System.debug statements in production code.
  - Enforce that all Apex classes must end with Service, Controller, Handler, or Helper suffix.
  - Detect hardcoded Salesforce IDs in Apex classes.
  - Require that all test methods include assertions and cannot be empty.
  - Prevent usage of @future methods without proper error handling.
  - Enforce that all public methods must have proper documentation comments.
  - Prevent nested if statements deeper than 3 levels.
  - Require that all DML operations are wrapped in try-catch blocks.
  - Ensure all SOQL queries use bind variables instead of string concatenation.
  - Classes implementing Batchable must have proper error handling in execute().
  - All methods with @TestVisible must be in test classes only.
  - Enforce that all custom exceptions extend Exception class properly.
  - Require that all Database.query calls use escapeSingleQuotes for user input.
  - Ban the use of Test.isRunningTest() in production code.
  
  Note: This tool only prepares the prompt. A subsequent tool will use these details to generate the final XPath-based custom rule.`; 

export const inputSchema = z.object({
  sampleCode: z.string().describe("Sample code which violates the rule user is looking to generate a custom PMD rule for."),
  language: z.string().describe("Programming language of the sample code (e.g., 'apex', 'javascript', 'xml')."),
  engine: z.string().describe("Target analysis engine (e.g., 'pmd').") // right now it is only for pmd, but as it will be extended to other engines, it is included here
});
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
  status: z.string().describe(`'success' or an error message.`),
  prompt: z.string().describe('Generated prompt text to guide XPath creation.')
});
type OutputArgsShape = typeof outputSchema.shape;

export class GenerateXpathPromptMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
  public static readonly NAME: string = 'get_ast_nodes_to_generate_xpath';
  private readonly action: GetAstNodesAction;
  private readonly telemetryService?: TelemetryService;

  public constructor(
    action: GetAstNodesAction = new GetAstNodesActionImpl(),
    telemetryService?: TelemetryService
  ) {
    super();
    this.action = action;
    this.telemetryService = telemetryService;
  }
  public getReleaseState(): ReleaseState {
    return ReleaseState.NON_GA;
  }

  public getToolsets(): Toolset[] {
    return [Toolset.CODE_ANALYSIS];
  }

  public getName(): string {
    return GenerateXpathPromptMcpTool.NAME;
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Generate XPath Prompt",
      description: DESCRIPTION,
      inputSchema: inputSchema.shape,
      outputSchema: outputSchema.shape,
      annotations: {
        readOnlyHint: true
      }
    };
  }

  public async exec(input: z.infer<typeof inputSchema>): Promise<CallToolResult> {
    const validationError = validateInput(input);
    if (validationError) {
      return validationError;
    }

    const astResult = await this.action.exec(buildAstInput(input));
    if (astResult.status !== "success") {
      return buildToolResult({ status: astResult.status, prompt: "" });
    }

    const output = {
      status: "success",
      prompt: buildXpathPrompt({
        sampleCode: input.sampleCode,
        language: input.language,
        engine: input.engine,
        astNodes: astResult.nodes,
        astMetadata: astResult.metadata
      })
    };
    if (this.telemetryService) {
      this.telemetryService.sendEvent(Constants.TelemetryEventName, {
        source: Constants.TelemetrySource,
        sfcaEvent: "xpath_prompt_generated",
        engine: input.engine,
        language: input.language
      });
    }
    return buildToolResult(output);
  }
}

type BuildPromptInput = {
  sampleCode: string;
  language: string;
  engine: string;
  astNodes: GetAstNodesOutput["nodes"];
  astMetadata: GetAstNodesOutput["metadata"];
};

function buildXpathPrompt(input: BuildPromptInput): string {
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

function buildNodeSummaries(
  nodes: GetAstNodesOutput["nodes"],
  metadata: GetAstNodesOutput["metadata"]
): Array<{
  nodeName: string;
  parent: string | null;
  ancestors: string[];
  attributes: Record<string, string>;
  metadata: GetAstNodesOutput["metadata"][number] | null;
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

function validateInput(input: z.infer<typeof inputSchema>): CallToolResult | undefined {
  const language = input.language?.trim();
  if (!language) {
    return buildErrorResult("language is required");
  }

  const engine = input.engine?.trim().toLowerCase();
  if (!engine) {
    return buildErrorResult("engine is required");
  }
  if (engine !== "pmd") {
    return buildErrorResult(`engine '${engine}' is not supported yet`);
  }

  const sampleCode = input.sampleCode?.trim();
  if (!sampleCode) {
    return buildErrorResult(`code in ${language} is required`);
  }

  return undefined;
}

function buildAstInput(input: z.infer<typeof inputSchema>): GetAstNodesInput {
  return {
    code: input.sampleCode,
    language: input.language
  };
}

function buildErrorResult(status: string): CallToolResult {
  return buildToolResult({ status, prompt: "" });
}

function buildToolResult(output: { status: string; prompt: string }): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(output) }],
    structuredContent: output
  };
}

