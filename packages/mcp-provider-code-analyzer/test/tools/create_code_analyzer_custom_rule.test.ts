import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpToolConfig, ReleaseState, Toolset } from "@salesforce/mcp-provider-api";
import { CreateCodeAnalyzerCustomRuleMcpTool } from "../../src/tools/create_code_analyzer_custom_rule.js";
import { CreateCustomRuleAction, CreateCustomRuleInput, CreateCustomRuleOutput } from "../../src/actions/create-custom-rule.js";

describe("Tests for CreateCodeAnalyzerCustomRuleMcpTool", () => {
    let tool: CreateCodeAnalyzerCustomRuleMcpTool;

    beforeEach(() => {
        tool = new CreateCodeAnalyzerCustomRuleMcpTool();
    });

    it("When getReleaseState is called, then 'non-ga' is returned", () => {
        expect(tool.getReleaseState()).toEqual(ReleaseState.NON_GA);
    });

    it("When getToolsets is called, then 'code-analysis' is returned", () => {
        expect(tool.getToolsets()).toEqual([Toolset.CODE_ANALYSIS]);
    });

    it("When getName is called, then tool name is returned", () => {
        expect(tool.getName()).toEqual('create_code_analyzer_custom_rule');
    });

    it("When getConfig is called, then the correct configuration is returned", () => {
        const config: McpToolConfig = tool.getConfig();
        expect(config.title).toEqual('Create Code Analyzer Custom Rule');
        expect(config.description).toContain('CALL THIS TOOL when the user asks to create custom Code Analyzer rules');
        expect(config.inputSchema).toBeTypeOf('object');
        expect(Object.keys(config.inputSchema as object)).toEqual(['engine', 'language']);
        expect(config.outputSchema).toBeTypeOf('object');
        expect(Object.keys(config.outputSchema as object)).toEqual(['status', 'knowledgeBase', 'instructionsForLlm', 'nextStep', 'error']);
        expect(config.annotations).toEqual({ readOnlyHint: true });
    });

    describe('Tests for exec method', () => {
        it("When exec is called with valid inputs, then action is called with expected inputs", async () => {
            const spyAction: SpyCreateCustomRuleAction = new SpyCreateCustomRuleAction();
            tool = new CreateCodeAnalyzerCustomRuleMcpTool(spyAction);

            const input: CreateCustomRuleInput = {
                engine: 'pmd',
                language: 'apex'
            };

            const result: CallToolResult = await tool.exec(input);

            expect(spyAction.execCallHistory).toHaveLength(1);
            expect(spyAction.execCallHistory[0]).toEqual(input);

            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toEqual("text");
            expect(result.content[0].text).toContain("ready_for_xpath_generation");
            expect(result.structuredContent).toBeDefined();
            expect((result.structuredContent as CreateCustomRuleOutput).status).toEqual('ready_for_xpath_generation');
        });

        it("When exec is called with valid inputs, then action receives correct inputs", async () => {
            const spyAction: SpyCreateCustomRuleAction = new SpyCreateCustomRuleAction();
            tool = new CreateCodeAnalyzerCustomRuleMcpTool(spyAction);

            const input: CreateCustomRuleInput = {
                engine: 'pmd',
                language: 'apex'
            };

            const result: CallToolResult = await tool.exec(input);

            expect(spyAction.execCallHistory).toHaveLength(1);
            expect(spyAction.execCallHistory[0].engine).toEqual('pmd');
            expect(spyAction.execCallHistory[0].language).toEqual('apex');
            expect(result.structuredContent).toBeDefined();
        });


        it("When exec is called with empty language, then validation error is returned", async () => {
            const input: CreateCustomRuleInput = {
                engine: 'pmd',
                language: ''
            };

            const result: CallToolResult = await tool.exec(input);

            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toEqual("text");
            expect(result.structuredContent).toBeDefined();
            expect((result.structuredContent as CreateCustomRuleOutput).status).toEqual('error');
            expect((result.structuredContent as CreateCustomRuleOutput).error).toContain( "Language '' support is not yet added for the Create Custom Rule MCP tool. Currently supported languages: apex.");
        });

        it("When exec is called with missing engine, then validation error is returned", async () => {
            const input = {
                language: 'apex'
                // engine is missing
            } as any;

            const result: CallToolResult = await tool.exec(input);

            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toEqual("text");
            expect(result.structuredContent).toBeDefined();
            expect((result.structuredContent as CreateCustomRuleOutput).status).toEqual('error');
            expect((result.structuredContent as CreateCustomRuleOutput).error).toContain("Engine 'undefined' does not support custom rules or is not yet implemented.");
        });

        it('When action throws error, then return error result', async () => {
            const throwingAction: ThrowingCreateCustomRuleAction = new ThrowingCreateCustomRuleAction();
            tool = new CreateCodeAnalyzerCustomRuleMcpTool(throwingAction);

            const input: CreateCustomRuleInput = {
                engine: 'pmd',
                language: 'apex'
            };

            const result: CallToolResult = await tool.exec(input);

            const expectedOutput: CreateCustomRuleOutput = {
                status: "error",
                error: "Error from ThrowingCreateCustomRuleAction"
            };
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toEqual("text");
            expect(result.content[0].text).toEqual(JSON.stringify(expectedOutput));
            expect(result.structuredContent).toEqual(expectedOutput);
        });

        it('When action returns error status, then return error result', async () => {
            const errorAction: ErrorCreateCustomRuleAction = new ErrorCreateCustomRuleAction();
            tool = new CreateCodeAnalyzerCustomRuleMcpTool(errorAction);

            const input: CreateCustomRuleInput = {
                engine: 'eslint',
                language: 'javascript'
            };

            const result: CallToolResult = await tool.exec(input);

            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toEqual("text");
            expect(result.structuredContent).toBeDefined();
            expect((result.structuredContent as CreateCustomRuleOutput).status).toEqual('error');
            expect((result.structuredContent as CreateCustomRuleOutput).error).toContain('does not support custom rules');
        });

        it('When exec is called with different engines, then correct engine is passed to action', async () => {
            const spyAction: SpyCreateCustomRuleAction = new SpyCreateCustomRuleAction();
            tool = new CreateCodeAnalyzerCustomRuleMcpTool(spyAction);

            const input: CreateCustomRuleInput = {
                engine: 'pmd',
                language: 'apex'
            };

            await tool.exec(input);

            expect(spyAction.execCallHistory[0].engine).toEqual('pmd');
        });

        it('When exec is called with different languages, then correct language is passed to action', async () => {
            const spyAction: SpyCreateCustomRuleAction = new SpyCreateCustomRuleAction();
            tool = new CreateCodeAnalyzerCustomRuleMcpTool(spyAction);

            const input: CreateCustomRuleInput = {
                engine: 'pmd',
                language: 'apex'
            };

            await tool.exec(input);

            expect(spyAction.execCallHistory[0].language).toEqual('apex');
        });
    });
});

class SpyCreateCustomRuleAction implements CreateCustomRuleAction {
    public execCallHistory: CreateCustomRuleInput[] = [];
    public exec(input: CreateCustomRuleInput): Promise<CreateCustomRuleOutput> {
        this.execCallHistory.push(input);
        return Promise.resolve({
            status: 'ready_for_xpath_generation',
            knowledgeBase: {
                availableNodes: ['UserClass', 'Method', 'MethodCallExpression'],
                nodeCount: 3
            },
            instructionsForLlm: 'Generate XPath rules',
            nextStep: {
                action: 'Generate XPath rule configuration',
                then: 'Call apply_code_analyzer_custom_rule'
            }
        });
    }
}

class ThrowingCreateCustomRuleAction implements CreateCustomRuleAction {
    exec(_input: CreateCustomRuleInput): Promise<CreateCustomRuleOutput> {
        throw new Error("Error from ThrowingCreateCustomRuleAction");
    }
}

class ErrorCreateCustomRuleAction implements CreateCustomRuleAction {
    exec(input: CreateCustomRuleInput): Promise<CreateCustomRuleOutput> {
        return Promise.resolve({
            status: 'error',
            error: `Engine '${input.engine}' does not support custom rules or is not yet implemented.`
        });
    }
}

