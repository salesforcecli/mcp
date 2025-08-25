import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DescribeRuleAction, DescribeRuleInput, DescribeRuleOutput } from "../../src/actions/describe-rule.js";
import { CodeAnalyzerDescribeRuleMcpTool } from "../../src/tools/sf-code-analyzer-describe-rule.js";
import { McpToolConfig, Toolset } from "@salesforce/mcp-provider-api";

describe("Tests for DescribeRuleTool", () => {
    let tool: CodeAnalyzerDescribeRuleMcpTool;

    beforeEach(() => {
        tool = new CodeAnalyzerDescribeRuleMcpTool();
    });

    it("When getToolsets is called, then 'experimental' is returned", () => {
        expect(tool.getToolsets()).toEqual([Toolset.EXPERIMENTAL]);
    });

    it("When getName is called, then 'sf-example' is returned", () => {
        expect(tool.getName()).toEqual('sf-code-analyzer-describe-rule');
    });

    it("When getConfig is called, then the correct configuration is returned", () => {
        const config: McpToolConfig = tool.getConfig();
        expect(config.title).toEqual('Describe Code Analyzer Rule');
        expect(config.description).toContain('A tool for getting the description of a Code Analyzer rule.');
        expect(config.inputSchema).toBeTypeOf('object');
        expect(Object.keys(config.inputSchema as object)).toEqual(['ruleName', 'engineName']);
        expect(config.outputSchema).toBeTypeOf('object');
        expect(Object.keys(config.outputSchema as object)).toEqual(['status', 'rule']);
        expect(config.annotations).toEqual({readOnlyHint: true});
    });

    describe('Tests for exec method', () => {
        it("When exec is called with valid inputs, then action is called with expected inputs", async () => {
            const spyAction: SpyDescribeRuleAction = new SpyDescribeRuleAction();
            tool = new CodeAnalyzerDescribeRuleMcpTool(spyAction);

            const input: DescribeRuleInput = {
                ruleName: 'test-rule',
                engineName: 'test-engine'
            };

            const result: CallToolResult = await tool.exec(input);

            expect(spyAction.execCallHistory).toHaveLength(1);
            expect(spyAction.execCallHistory[0]).toEqual(input);

            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toEqual("text");
            expect(result.content[0].text).toContain("Spy successfully invoked");
        });

        it('When action throws error, then return error result', async () => {
            const throwingAction: ThrowingDescribeRuleAction = new ThrowingDescribeRuleAction();
            tool = new CodeAnalyzerDescribeRuleMcpTool(throwingAction);

            const input: DescribeRuleInput = {
                ruleName: 'test-rule',
                engineName: 'test-engine'
            };
            const result: CallToolResult = await tool.exec(input);

            const expectedOutput: DescribeRuleOutput = {
                status: "Error from ThrowingDescribeRuleAction"
            }
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toEqual("text");
            expect(result.content[0].text).toEqual(JSON.stringify(expectedOutput));
            expect(result.structuredContent).toEqual(expectedOutput);
        });
    });
});

class SpyDescribeRuleAction implements DescribeRuleAction {
    public execCallHistory: DescribeRuleInput[] = [];
    public exec(input: DescribeRuleInput): Promise<DescribeRuleOutput> {
        this.execCallHistory.push(input);
        return Promise.resolve({
            status: 'Spy successfully invoked',
        });
    }
}

class ThrowingDescribeRuleAction implements DescribeRuleAction {
    exec(_input: DescribeRuleInput): Promise<DescribeRuleOutput> {
        throw new Error("Error from ThrowingDescribeRuleAction");
    }
}