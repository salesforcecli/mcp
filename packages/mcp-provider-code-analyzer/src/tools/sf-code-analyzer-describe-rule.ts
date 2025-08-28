import { z }  from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset } from "@salesforce/mcp-provider-api";
import { DescribeRuleAction, DescribeRuleActionImpl, DescribeRuleInput, DescribeRuleOutput} from "../actions/describe-rule.js";
import { CodeAnalyzerConfigFactoryImpl } from "../factories/CodeAnalyzerConfigFactory.js";
import { EnginePluginsFactoryImpl } from "../factories/EnginePluginsFactory.js";
import { getErrorMessage } from "../utils.js";

const DESCRIPTION: string = `A tool for getting the description of a Code Analyzer rule.\n` +
    `This tool can return a JSON that describes the properties of a Code Analyzer rule, which may include information about\n` +
    `how it can be fixed.\n` +
    `\n` +
    `When to use this tool:\n` +
    `- When analysis results reference a rule but do not provide enough information for you to confidently fix the violation.\n` +
    `- When the user asks for information about a specific rule or violation.\n` +
    `\n` +
    `Parameters explained:\n` +
    `- ruleName: A string corresponding to the name of the rule that should be described.\n` +
    `- engineName: A string corresponding to the name of the engine to which the desired rule belongs.\n` +
    `\n` +
    `Output explained:\n` +
    `- status: A string indicating whether the operation as a whole was successful.\n` +
    `  * In a successful run, this will be "success".\n` +
    `  * In a failed run, this will be an error message.\n` +
    `- rule: A JSON containing the properties of the rule. If this property is absent, it means no such rule existed.\n` +
    `  The JSON will have the following properties:\n` +
    `  - name: The name of the rule. Will be equal to the "ruleName" supplied as input to the tool.\n` +
    `  - engine: The name of the engine to which this rule belongs. Equivalent to the "engineName" input.\n` +
    `  - severity: A number between 1 and 5 indicating the severity of the rule. Lower numbers are MORE severe.\n` +
    `  - tags: An array of strings indicating the tags that are applicable to this rule, e.g. "performance", "security", etc.\n` +
    `  - description: A string describing the purpose and functionality of the rule in question.\n` +
    `  - resources: A possibly-empty array of strings indicating URLs or paths to documentation or other helpful information.\n`;

const inputSchema = z.object({
    ruleName: z.string().describe('The name of a rule about which more information is required'),
    engineName: z.string().describe('The engine to which the rule belongs. Resolves ambiguity when rules have the same name.')
});
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
    status: z.string().describe('If the operation succeeds, this will be "success". Otherwise, it will be an error message.'),
    rule: z.object({
        name: z.string().describe('The name of the rule, equivalent to the `ruleName` input property.'),
        engine: z.string().describe('The name of the engine to which the rule belongs.'),
        severity: z.number().describe('An integer between 1 and 5 indicating the severity of the rule. Lower numbers are MORE severe.'),
        tags: z.array(z.string()).describe('An array of strings indicating tags applicable to the rule, e.g. "performance", "security", etc.'),
        description: z.string().describe('A string describing the purpose and functionality of the rule.'),
        resources: z.array(z.string()).describe('A possibly empty array of strings that represent links to documentation or other helpful material.')
    }).optional().describe('If a rule exists with the specified name, this is its description.')
});
type OutputArgsShape = typeof outputSchema.shape;


export class CodeAnalyzerDescribeRuleMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
    private readonly action: DescribeRuleAction;

    public constructor(
        action: DescribeRuleAction = new DescribeRuleActionImpl({
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
        return [Toolset.OTHER];
    }

    public getName(): string {
        return "sf-code-analyzer-describe-rule"; 
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Describe Code Analyzer Rule",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: outputSchema.shape,
            annotations: {
                readOnlyHint: true
            }
        };
    }

    public async exec(input: DescribeRuleInput): Promise<CallToolResult> {
        let output: DescribeRuleOutput;
        try {
            output = await this.action.exec(input);
        } catch (e) {
            output = { status: getErrorMessage(e) };
        }
        return {
            content: [{ type: "text", text: JSON.stringify(output) }],
            structuredContent: output
        };
    }
}