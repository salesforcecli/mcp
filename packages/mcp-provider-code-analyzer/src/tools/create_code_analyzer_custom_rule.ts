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
  the tool will return a minimal response indicating the knowledge base is already available.
- Reuse the knowledge base from your previous context instead of requesting it again.
- This significantly reduces token usage for subsequent rule generation requests.

Example: User wants 5 rules - 3 for PMD+Apex, 2 for PMD+JavaScript
→ Call this tool 2x (once for PMD+Apex, once for PMD+JavaScript)`;

export const inputSchema = z.object({
    engine: z.enum(['pmd', 'eslint', 'regex']).describe("Required: Which engine to create the rule for."),
    language: z.string().describe("Required: The target language for the custom rule. Examples: 'apex', 'javascript', 'typescript', 'html', 'xml', 'visualforce'") });
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
    status: z.string().describe("'ready_for_xpath_generation' if successful, 'error' otherwise"),
    knowledgeBase: z.any().optional().describe("Knowledge base for generating XPath rules."),
    instructionsForLlm: z.string().optional().describe("Detailed guidelines for generating XPath"),
    nextStep: z.object({
        action: z.string(),
        optional: z.string().optional(),
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

    public async exec(input: CreateCustomRuleInput): Promise<CallToolResult> {
        let output: CreateCustomRuleOutput;
        try {
            validateInput(input);
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

function validateInput(input: CreateCustomRuleInput): void {
    if (!input.engine) {
        throw new Error("Valid engine is required.");
    }

    if (!input.language || input.language.trim().length === 0) {
        throw new Error("language is required and cannot be empty");
    }
}

