import fs from "node:fs";
import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Services, Toolset } from "@salesforce/mcp-provider-api";
import { getMessage } from "../messages.js";
import { getErrorMessage } from "../utils.js";
import { CreateCustomRuleAction, CreateCustomRuleActionImpl, CreateCustomRuleInput, CreateCustomRuleOutput } from "../actions/create-custom-rule.js";

const MAX_SAMPLE_FILES = 10;

const DESCRIPTION: string = `[ORCHESTRATION PATTERN - STEP 1]
Create a custom Code Analyzer rule - Step 1: Prepare knowledge base for LLM.

This is the first step in the orchestration pattern workflow:
1. This tool loads engine-specific knowledge base and returns it to the LLM
2. LLM uses knowledge base to generate rule configuration(s)
3. LLM calls apply_custom_pmd_rule() with each generated config

Supports three engines:
- PMD: XPath-based rules for Apex code
- ESLint: JavaScript/TypeScript rules for LWC/Aura
- Regex: Pattern-based rules for any file type

⚠️ CRITICAL FOR MULTIPLE RULES (COST OPTIMIZATION):
Call this tool ONLY ONCE even if user requests multiple rules!
The knowledge base works for ALL rules - generate all configs from one KB load.
Then call apply_custom_pmd_rule() separately for each config.

Example: User wants 3 rules → Call create_custom_pmd_rule() 1x, apply_custom_pmd_rule() 3x
This saves ~2,600 tokens per additional rule (78% cost reduction for batch!)

TWO USE CASES:

Use Case 1 - Dynamic AST Extraction (WITH sample files):
When user provides Apex files to analyze, this tool:
- Parses the provided Apex files using parse_apex_ast
- Extracts real AST patterns from the code
- Builds dynamic knowledge base with actual examples
- Returns node examples with real attributes and structure

Use Case 2 - Static AST Reference (WITHOUT sample files):
When no sample files provided, this tool:
- Loads optimized static AST reference documentation
- Returns common nodes and attributes
- Provides fallback to get_node_details for additional nodes

WHEN TO USE THIS TOOL:
- When user asks to "create a custom rule" or "create rules to..."
- For single OR multiple rules (call once regardless of count)
- For flexible, knowledge-based rule generation

This tool:
- Finds the SFDX project root
- Either parses sample Apex files OR loads static AST reference
- Returns detailed instructions for XPath generation`;

export const inputSchema = z.object({
    userPrompt: z.string().describe("Natural language description of the rule(s). Single: 'Ban System.debug calls' Multiple: 'Create rules: 1. Ban System.debug 2. Classes end with Service'"),
    engine: z.enum(['pmd', 'eslint', 'regex']).describe("Required: Which engine to create the rule for. 'pmd' for Apex XPath rules, 'eslint' for JavaScript/TypeScript rules, 'regex' for pattern-based rules"),
    currentDirectory: z.string().optional().describe("Starting directory to search for SFDX project (default: current working directory)") });
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
    status: z.string().describe("'ready_for_xpath_generation' if successful, 'error' otherwise"),
    projectRoot: z.string().optional().describe("Absolute path to SFDX project root"),
    userPrompt: z.string().optional().describe("The original user prompt"),
    knowledgeBase: z.any().optional().describe("Knowledge base for generating XPath rules. Either optimized static reference OR dynamic AST examples."),
    instructionsForLlm: z.string().optional().describe("Detailed guidelines for generating XPath"),
    nextStep: z.object({
        action: z.string(),
        optional: z.string().optional(),
        then: z.string()
    }).optional().describe("Next steps in the orchestration pattern"),
    workflowSteps: z.array(z.any()).optional().describe("Steps completed in this workflow"),
    error: z.string().optional().describe("Error message if something went wrong")
});
type OutputArgsShape = typeof outputSchema.shape;

export class CreateCustomPmdRuleMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
    public static readonly NAME: string = 'create_custom_pmd_rule';
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
        return CreateCustomPmdRuleMcpTool.NAME;
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Create Custom PMD Rule",
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
    if (!input.userPrompt || input.userPrompt.trim().length === 0) {
        throw new Error("userPrompt is required and cannot be empty");
    }

    if (!input.engine) {
        throw new Error("engine is required. Must be one of: pmd, eslint, regex");
    }
}

