import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Services, Toolset } from "@salesforce/mcp-provider-api";
import { getMessage } from "../messages.js";
import { getErrorMessage } from "../utils.js";
import { ApplyCustomRuleAction, ApplyCustomRuleActionImpl, ApplyCustomRuleInput, ApplyCustomRuleOutput } from "../actions/apply-custom-rule.js";

const DESCRIPTION: string = `[ORCHESTRATION PATTERN - STEP 2]
Apply LLM-generated rule configuration(s) to the project.

This is the second step in the orchestration pattern workflow:
1. LLM has already generated rule configuration(s) using knowledge base
2. This tool applies those configuration(s) to the project (creates files, updates config)
3. Returns testing instructions and next steps

WHEN TO USE THIS TOOL:
- After calling create_code_analyzer_custom_rule() and generating rule config(s)
- When you have valid rule configuration JSON(s) ready to be applied
- Can process multiple rules in a single call (pass array of ruleConfigJson)

This tool:
- Validates all LLM-generated rule configurations
- Creates/updates code-analyzer.yml
- Creates custom-rules/ directory
- Generates rule files (PMD XML, ESLint JS, etc.)
- Updates code-analyzer.yml to reference all new rulesets
- Provides testing commands for all rules`;

export const inputSchema = z.object({
    ruleConfigJson: z.array(z.string()).describe(`Array of JSON strings with engine-specific rule configurations. Each JSON string must be a valid rule configuration object.

REQUIRED FIELDS (all engines):
- engine: "pmd" | "eslint" | "regex" (specified in each rule config - can mix multiple engines in one call)
- rule_name: string (unique rule identifier, e.g., "BanSystemDebug")
- message: string (violation message shown to developers)
- severity: number (1=Critical, 2=High, 3=Moderate, 4=Low, 5=Info)
- description: string (detailed rule description)

ENGINE-SPECIFIC REQUIRED FIELDS:

PMD (for Apex/XML/HTML):
- xpath: string (XPath expression, e.g., "//UserClass[not(ends-with(@Image, 'Service'))]")

EXAMPLES:

PMD Example:
['{"engine": "pmd", "xpath": "//UserClass[not(ends-with(@Image, 'Service'))]", "rule_name": "EnforceClassNamingSuffix", "message": "Class name must end with 'Service'", "severity": 2, "description": "Enforces that all service classes end with 'Service' suffix"}']`),
    projectRoot: z.string().describe("Absolute path to SFDX project root")
});
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
    status: z.string().describe("'completed' if all successful, 'partial' if some failed, 'error' if all failed"),
    rulesProcessed: z.number().optional().describe("Total number of rules processed"),
    rulesSucceeded: z.number().optional().describe("Number of rules successfully created"),
    rulesFailed: z.number().optional().describe("Number of rules that failed"),
    ruleDetails: z.array(z.object({
        name: z.string().describe("Rule name"),
        description: z.string().describe("Rule description")
    })).optional().describe("Details of all created rules (name and description only)"),
    filesCreated: z.array(z.object({
        type: z.string(),
        path: z.string(),
        relativePath: z.string()
    })).optional().describe("List of files that were created"),
    filesModified: z.array(z.object({
        type: z.string(),
        path: z.string(),
        modification: z.string()
    })).optional().describe("List of files that were modified"),
    errors: z.array(z.object({
        ruleName: z.string().optional(),
        error: z.string()
    })).optional().describe("Errors encountered for specific rules"),
    error: z.string().optional().describe("General error message if something went wrong"),
    testingInstructions: z.string().optional().describe("Instructions for LLM to generate test files and validate the custom rules")
});
type OutputArgsShape = typeof outputSchema.shape;

export class ApplyCodeAnalyzerCustomRuleMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
    public static readonly NAME: string = 'apply_code_analyzer_custom_rule';
    private readonly action: ApplyCustomRuleAction;

    public constructor(
        action: ApplyCustomRuleAction = new ApplyCustomRuleActionImpl()
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
        return ApplyCodeAnalyzerCustomRuleMcpTool.NAME;
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Apply Custom Rule",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: outputSchema.shape,
            annotations: {
                readOnlyHint: false  // This tool creates and modifies files
            }
        };
    }

    public async exec(input: ApplyCustomRuleInput): Promise<CallToolResult> {
        let output: ApplyCustomRuleOutput;
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