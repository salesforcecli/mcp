import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset } from "@salesforce/mcp-provider-api";

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

  public constructor() {
    super();
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

  // Intentionally minimal stub; will be implemented later
  public async exec(_input: z.infer<typeof inputSchema>): Promise<CallToolResult> {
    const output = {
      status: "success",
      prompt: ""
    };
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output
    };
  }
}

