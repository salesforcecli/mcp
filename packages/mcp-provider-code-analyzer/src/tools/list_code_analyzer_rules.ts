import {z} from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {McpTool, ReleaseState, McpToolConfig, Toolset} from "@salesforce/mcp-provider-api";
import {ListRulesAction, ListRulesInput, ListRulesOutput, ListRulesActionImpl} from "../actions/list-rules.js";
import {CodeAnalyzerConfigFactoryImpl} from "../factories/CodeAnalyzerConfigFactory.js";
import {EnginePluginsFactoryImpl} from "../factories/EnginePluginsFactory.js";
import {getErrorMessage} from "../utils.js";


const DESCRIPTION: string = `A tool for selecting Code Analyzer rules based on a number of criteria.\n` +
    `This tool can return a JSON array containing the descriptions of Code Analyzer Rules that match rule selectors.\n` +
    `Rule selectors are camel-cased strings that are joined with colons to represent logical-AND, or commas to represent logical-OR.\n` +
    `For example:\n` +
    `- "Recommended" selects all rules with the Recommended tag.\n` +
    `- "Performance:pmd:critical" selects all rules in the PMD engine with the Performance tag and a severity of Critical.\n` +
    `- "PMD,ESLint" selects all rules in either the PMD engine or the ESLint engine.\n` +
    `When to use this tool:\n` +
    `- When the user asks for information about a category of rules, such as "tell me about all performance rules".`;

export const inputSchema = z.object({
    selector: z.string().describe("A selector for Code Analyzer rules. Must meet the criteria outlined in the tool-level description.")
});
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
    status: z.string().describe('If the operation succeeds, this will be "success". Otherwise, it will be an error message.'),
    rules: z.array(z.object({
        name: z.string().describe('The name of the rule, equivalent to the `ruleName` input property.'),
        engine: z.string().describe('The name of the engine to which the rule belongs.'),
        severity: z.number().describe('An integer between 1 and 5 indicating the severity of the rule. Lower numbers are MORE severe.'),
        tags: z.array(z.string()).describe('An array of strings indicating tags applicable to the rule, e.g. "performance", "security", etc.'),
        description: z.string().describe('A string describing the purpose and functionality of the rule.'),
        resources: z.array(z.string()).describe('A possibly empty array of strings that represent links to documentation or other helpful material.')
    })).optional().describe('An array of rules that matched the selector. Empty if no rules matched.')
});
type OutputArgsShape = typeof outputSchema.shape;

export class CodeAnalyzerListRulesMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
    public static readonly NAME: string = 'list_code_analyzer_rules';
    private readonly action: ListRulesAction;

    public constructor(
        action: ListRulesAction = new ListRulesActionImpl({
            configFactory: new CodeAnalyzerConfigFactoryImpl(),
            enginePluginsFactory: new EnginePluginsFactoryImpl()
        })
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
        return CodeAnalyzerListRulesMcpTool.NAME;
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "List Code Analyzer Rules",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: outputSchema.shape,
            annotations: {
                readOnlyHint: true
            }
        }
    }

    public async exec(input: ListRulesInput): Promise<CallToolResult> {
        let output: ListRulesOutput;
        try {
            output = await this.action.exec(input);
        } catch (e) {
            output = { status: getErrorMessage(e) }
        }
        return {
            content: [{ type: "text", text: JSON.stringify(output)}],
            structuredContent: output
        };
    }
}