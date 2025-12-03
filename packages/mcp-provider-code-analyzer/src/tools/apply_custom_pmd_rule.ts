import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Services, Toolset } from "@salesforce/mcp-provider-api";
import { getMessage } from "../messages.js";
import { getErrorMessage } from "../utils.js";
import { ApplyCustomRuleAction, ApplyCustomRuleActionImpl, ApplyCustomRuleInput, ApplyCustomRuleOutput } from "../actions/apply-custom-rule.js";

const DESCRIPTION: string = `[ORCHESTRATION PATTERN - STEP 2]
Apply LLM-generated rule configuration to the project.

This is the second step in the orchestration pattern workflow:
1. LLM has already generated XPath rule configuration using knowledge base
2. This tool applies that configuration to the project (creates files, updates config)
3. Returns testing instructions and next steps

WHEN TO USE THIS TOOL:
- After calling create_custom_pmd_rule() and generating XPath config
- When you have a valid rule configuration JSON ready to be applied

This tool:
- Validates the LLM-generated rule configuration
- Creates/updates code-analyzer.yml
- Creates custom-rules/ directory
- Generates PMD ruleset XML file
- Updates code-analyzer.yml to reference the new ruleset
- Provides testing commands`;

export const inputSchema = z.object({
    ruleConfigJson: z.string().describe(`JSON string with engine-specific rule configuration. 
    
PMD Example: '{"engine": "pmd", "xpath": "//UserClass[...]", "rule_name": "EnforceNaming", "message": "Classes must end with proper suffix", "severity": 2, "tags": ["BestPractices"], "description": "Enforces naming conventions"}'

ESLint Example: '{"engine": "eslint", "rule_name": "no-console-log", "rule_code": "module.exports = {...}", "message": "No console.log", "severity": 2, "description": "Prevents console.log"}'

Regex Example: '{"engine": "regex", "rule_name": "no-hardcoded-ids", "pattern": "...", "message": "No hardcoded IDs", "severity": 2, "files": ["*.cls"], "description": "Detects hardcoded IDs"}'`),
    projectRoot: z.string().describe("Absolute path to SFDX project root (from create_custom_rule response)"),
    engine: z.enum(['pmd', 'eslint', 'regex']).describe("Required: Which engine this rule is for. Must match the engine in ruleConfigJson")
});
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
    status: z.string().describe("'completed' if successful, 'error' otherwise"),
    ruleDetails: z.object({
        name: z.string(),
        description: z.string(),
        xpath: z.string(),
        message: z.string(),
        severity: z.number(),
        severityLabel: z.string(),
        tags: z.array(z.string()),
        explanation: z.string().optional()
    }).optional().describe("Details of the created rule"),
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
    testingInstructions: z.object({
        step_1_verify_rule_loaded: z.object({
            command: z.string(),
            expected: z.string()
        }),
        step_2_test_on_apex_classes: z.object({
            command: z.string(),
            expected: z.string()
        }),
        step_3_run_all_custom_rules: z.object({
            command: z.string(),
            expected: z.string()
        })
    }).optional().describe("Commands to verify and test the rule"),
    nextSteps: z.array(z.object({
        step: z.number(),
        action: z.string(),
        file: z.string().optional(),
        command: z.string().optional()
    })).optional().describe("Next steps to take"),
    workflowSteps: z.array(z.any()).optional().describe("Steps completed in this workflow"),
    error: z.string().optional().describe("Error message if something went wrong")
});
type OutputArgsShape = typeof outputSchema.shape;

export class ApplyCustomPmdRuleMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
    public static readonly NAME: string = 'apply_custom_pmd_rule';
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
        return ApplyCustomPmdRuleMcpTool.NAME;
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Apply Custom PMD Rule",
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

