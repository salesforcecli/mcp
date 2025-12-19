import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset } from "@salesforce/mcp-provider-api";
import { getErrorMessage } from "../utils.js";
import { CreateCustomRuleAction, CreateCustomRuleActionImpl, CreateCustomRuleInput, CreateCustomRuleOutput } from "../actions/create-custom-rule.js";

const DESCRIPTION: string = `🚨 CALL THIS TOOL when the user asks to create custom Code Analyzer rules.

WHEN TO USE THIS TOOL:
- User asks to create Code Analyzer custom rule(s) → CALL THIS FIRST

This tool loads the knowledge base needed to generate rule configurations. It is the REQUIRED FIRST STEP in creating custom rules.

⚠️ CRITICAL: ENGINE/LANGUAGE SPECIFICITY
This tool is engine and language specific. If the user requests multiple rules:
- Group rules by engine+language combination (e.g., all PMD+Apex rules together)
- Call this tool ONCE per unique engine+language combination

💡 TOKEN OPTIMIZATION:
- If you've already called this tool for the same engine+language combination in this conversation,
  AND you already have the availableNodes list from the previous response in your context,
  then SKIP calling this tool again.
- Instead, extract the node names you need from the previous response's availableNodes array,
  and call get_code_analyzer_node_details([node_names]) directly with those node names.
- This will give you the attributes, category, and important notes without re-fetching the full node list.
- This significantly reduces token usage for subsequent rule generation requests.

Example: User wants 5 rules - 3 for PMD+Apex, 2 for PMD+JavaScript
→ Call this tool 2x (once for PMD+Apex, once for PMD+JavaScript)`;

export const inputSchema = z.object({
    engine: z.enum(['pmd', 'eslint', 'regex']).describe("Which engine to create the rule for."),
    language: z.enum(['apex', 'javascript', 'typescript', 'html', 'xml', 'visualforce']).describe("The target language for the custom rule.") });
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
    status: z.string().describe("'ready_for_xpath_generation' if successful, 'error' otherwise"),
    knowledgeBase: z.object({
        availableNodes: z.array(z.string()).describe("Array of available node names (use get_code_analyzer_node_details for full info)"),
        nodeCount: z.number().describe("Total number of available nodes")
    }).optional().describe("Minimal knowledge base - node names only for token efficiency"),
    instructionsForLlm: z.string().optional().describe("Concise guidelines for generating XPath"),
    nextStep: z.object({
        action: z.string(),
        then: z.string()
    }).optional().describe("Next steps in the orchestration pattern"),
    error: z.string().optional().describe("Error message if something went wrong")
});
type OutputArgsShape = typeof outputSchema.shape;

export class CreateCodeAnalyzerCustomRuleMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
    public static readonly NAME: string = 'create_code_analyzer_custom_rule';
    private readonly action: CreateCustomRuleAction;

    public constructor(
        action: CreateCustomRuleAction = new CreateCustomRuleActionImpl()
    ) {
        super();
        this.action = action;
    }

    public getReleaseState(): ReleaseState {
        return ReleaseState.NON_GA;
    }

    public getToolsets(): Toolset[] {
        return [Toolset.CODE_ANALYSIS];
    }

    public getName(): string {
        return CreateCodeAnalyzerCustomRuleMcpTool.NAME;
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Create Code Analyzer Custom Rule",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: outputSchema.shape,
            annotations: {
                readOnlyHint: true  // This tool only reads files and documentation
            }
        };
    }

    /**
     * Executes the custom rule creation tool by validating input and delegating to the action.
     * 
     * This method validates the input parameters, calls the action to load the knowledge base,
     * and returns the result in both text and structured formats. Errors are caught and
     * returned as error status in the output.
     * 
     * @param input - The input parameters containing engine and language for rule creation
     * @returns A CallToolResult containing the knowledge base and instructions, or an error status
     * @throws Never throws - all errors are caught and returned in the output structure
     */
    public async exec(input: CreateCustomRuleInput): Promise<CallToolResult> {
        let output: CreateCustomRuleOutput;
        try {
            output = await this.action.exec(input);
        } catch (e) {
            output = { 
                status: "error",
                error: getErrorMessage(e) 
            };
        }
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output
        };
    }
}

