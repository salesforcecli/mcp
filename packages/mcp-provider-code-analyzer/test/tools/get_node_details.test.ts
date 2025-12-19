import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpToolConfig, ReleaseState, Toolset } from "@salesforce/mcp-provider-api";
import { GetNodeDetailsMcpTool } from "../../src/tools/get_code_analyzer_node_details.js";
import { GetNodeDetailsAction, GetNodeDetailsInput, GetNodeDetailsOutput } from "../../src/actions/get-node-details.js";

describe("Tests for GetNodeDetailsMcpTool", () => {
    let tool: GetNodeDetailsMcpTool;

    beforeEach(() => {
        tool = new GetNodeDetailsMcpTool();
    });

    it("When getReleaseState is called, then 'non-ga' is returned", () => {
        expect(tool.getReleaseState()).toEqual(ReleaseState.NON_GA);
    });

    it("When getToolsets is called, then 'code-analysis' is returned", () => {
        expect(tool.getToolsets()).toEqual([Toolset.CODE_ANALYSIS]);
    });

    it("When getName is called, then tool name is returned", () => {
        expect(tool.getName()).toEqual('get_code_analyzer_node_details');
    });

    it("When getConfig is called, then the correct configuration is returned", () => {
        const config: McpToolConfig = tool.getConfig();
        expect(config.title).toEqual('Get Node Details');
        expect(config.description).toContain('Get detailed information about AST nodes');
        expect(config.inputSchema).toBeTypeOf('object');
        expect(Object.keys(config.inputSchema as object)).toEqual(['engine', 'language', 'nodeNames']);
        expect(config.outputSchema).toBeTypeOf('object');
        expect(Object.keys(config.outputSchema as object)).toEqual(['status', 'nodeDetails', 'importantNotes', 'error']);
        expect(config.annotations).toEqual({ readOnlyHint: true });
    });

    describe('Tests for exec method', () => {
        it("When exec is called with valid inputs, then action is called with expected inputs", async () => {
            const spyAction: SpyGetNodeDetailsAction = new SpyGetNodeDetailsAction();
            tool = new GetNodeDetailsMcpTool(spyAction);

            const input: GetNodeDetailsInput = {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['UserClass', 'Method']
            };

            const result: CallToolResult = await tool.exec(input);

            expect(spyAction.execCallHistory).toHaveLength(1);
            expect(spyAction.execCallHistory[0]).toEqual(input);

            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toEqual("text");
            expect(result.content[0].text).toContain("success");
            expect(result.structuredContent).toBeDefined();
            expect((result.structuredContent as GetNodeDetailsOutput).status).toEqual('success');
        });

        it("When exec is called with valid inputs, then action receives correct inputs", async () => {
            const spyAction: SpyGetNodeDetailsAction = new SpyGetNodeDetailsAction();
            tool = new GetNodeDetailsMcpTool(spyAction);

            const input: GetNodeDetailsInput = {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['UserClass']
            };

            const result: CallToolResult = await tool.exec(input);

            expect(spyAction.execCallHistory).toHaveLength(1);
            expect(spyAction.execCallHistory[0].engine).toEqual('pmd');
            expect(spyAction.execCallHistory[0].language).toEqual('apex');
            expect(spyAction.execCallHistory[0].nodeNames).toEqual(['UserClass']);
            expect(result.structuredContent).toBeDefined();
        });

        it("When exec is called with empty language, then validation error is returned", async () => {
            const input: GetNodeDetailsInput = {
                engine: 'pmd',
                language: '',
                nodeNames: ['UserClass']
            };

            const result: CallToolResult = await tool.exec(input);

            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toEqual("text");
            expect(result.structuredContent).toBeDefined();
            expect((result.structuredContent as GetNodeDetailsOutput).status).toEqual('error');
            expect((result.structuredContent as GetNodeDetailsOutput).error).toContain('language is required');
        });

        it("When exec is called with missing engine, then validation error is returned", async () => {
            const input = {
                language: 'apex',
                nodeNames: ['UserClass']
                // engine is missing
            } as any;

            const result: CallToolResult = await tool.exec(input);

            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toEqual("text");
            expect(result.structuredContent).toBeDefined();
            expect((result.structuredContent as GetNodeDetailsOutput).status).toEqual('error');
            expect((result.structuredContent as GetNodeDetailsOutput).error).toContain('Valid engine is required');
        });

        it("When exec is called with empty nodeNames array, then validation error is returned", async () => {
            const input: GetNodeDetailsInput = {
                engine: 'pmd',
                language: 'apex',
                nodeNames: []
            };

            const result: CallToolResult = await tool.exec(input);

            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toEqual("text");
            expect(result.structuredContent).toBeDefined();
            expect((result.structuredContent as GetNodeDetailsOutput).status).toEqual('error');
            expect((result.structuredContent as GetNodeDetailsOutput).error).toContain('At least one node name is required');
        });

        it("When exec is called with missing nodeNames, then validation error is returned", async () => {
            const input = {
                engine: 'pmd',
                language: 'apex'
                // nodeNames is missing
            } as any;

            const result: CallToolResult = await tool.exec(input);

            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toEqual("text");
            expect(result.structuredContent).toBeDefined();
            expect((result.structuredContent as GetNodeDetailsOutput).status).toEqual('error');
            expect((result.structuredContent as GetNodeDetailsOutput).error).toContain('At least one node name is required');
        });

        it('When action throws error, then return error result', async () => {
            const throwingAction: ThrowingGetNodeDetailsAction = new ThrowingGetNodeDetailsAction();
            tool = new GetNodeDetailsMcpTool(throwingAction);

            const input: GetNodeDetailsInput = {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['UserClass']
            };

            const result: CallToolResult = await tool.exec(input);

            const expectedOutput: GetNodeDetailsOutput = {
                status: "error",
                error: "Error from ThrowingGetNodeDetailsAction"
            };
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toEqual("text");
            expect(result.content[0].text).toEqual(JSON.stringify(expectedOutput, null, 2));
            expect(result.structuredContent).toEqual(expectedOutput);
        });

        it('When action returns error status, then return error result', async () => {
            const errorAction: ErrorGetNodeDetailsAction = new ErrorGetNodeDetailsAction();
            tool = new GetNodeDetailsMcpTool(errorAction);

            const input: GetNodeDetailsInput = {
                engine: 'eslint',
                language: 'javascript',
                nodeNames: ['SomeNode']
            };

            const result: CallToolResult = await tool.exec(input);

            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toEqual("text");
            expect(result.structuredContent).toBeDefined();
            expect((result.structuredContent as GetNodeDetailsOutput).status).toEqual('error');
            expect((result.structuredContent as GetNodeDetailsOutput).error).toContain('does not support node details');
        });

        it('When exec is called with multiple node names, then all node names are passed to action', async () => {
            const spyAction: SpyGetNodeDetailsAction = new SpyGetNodeDetailsAction();
            tool = new GetNodeDetailsMcpTool(spyAction);

            const input: GetNodeDetailsInput = {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['UserClass', 'Method', 'MethodCallExpression']
            };

            await tool.exec(input);

            expect(spyAction.execCallHistory[0].nodeNames).toEqual(['UserClass', 'Method', 'MethodCallExpression']);
        });

        it('When exec returns success, then nodeDetails and importantNotes should be present', async () => {
            const spyAction: SpyGetNodeDetailsAction = new SpyGetNodeDetailsAction();
            tool = new GetNodeDetailsMcpTool(spyAction);

            const input: GetNodeDetailsInput = {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['UserClass']
            };

            const result: CallToolResult = await tool.exec(input);

            expect(result.structuredContent).toBeDefined();
            const output = result.structuredContent as GetNodeDetailsOutput;
            expect(output.status).toEqual('success');
            expect(output.nodeDetails).toBeDefined();
            expect(output.importantNotes).toBeDefined();
            expect(output.nodeDetails?.length).toBeGreaterThan(0);
            expect(output.importantNotes?.length).toBeGreaterThan(0);
        });

        it('When exec returns success, then nodeDetails should have correct structure', async () => {
            const spyAction: SpyGetNodeDetailsAction = new SpyGetNodeDetailsAction();
            tool = new GetNodeDetailsMcpTool(spyAction);

            const input: GetNodeDetailsInput = {
                engine: 'pmd',
                language: 'apex',
                nodeNames: ['UserClass']
            };

            const result: CallToolResult = await tool.exec(input);

            const output = result.structuredContent as GetNodeDetailsOutput;
            const nodeDetail = output.nodeDetails?.[0];
            
            expect(nodeDetail?.name).toBeDefined();
            expect(nodeDetail?.description).toBeDefined();
            expect(nodeDetail?.attributes).toBeDefined();
            expect(Array.isArray(nodeDetail?.attributes)).toBe(true);
        });
    });
});

class SpyGetNodeDetailsAction implements GetNodeDetailsAction {
    public execCallHistory: GetNodeDetailsInput[] = [];
    public exec(input: GetNodeDetailsInput): Promise<GetNodeDetailsOutput> {
        this.execCallHistory.push(input);
        return Promise.resolve({
            status: 'success',
            nodeDetails: [
                {
                    name: 'UserClass',
                    description: 'Represents an Apex class declaration',
                    category: 'Declarations',
                    extends: 'BaseApexClass',
                    implements: [],
                    attributes: [
                        {
                            name: '@Image',
                            type: 'string',
                            description: 'Returns the name of this class'
                        }
                    ]
                },
                {
                    name: 'BaseApexClass',
                    description: 'Parent class that provides inherited attributes to child nodes',
                    category: 'Inheritance',
                    attributes: [
                        {
                            name: '@Image',
                            type: 'string',
                            description: 'Attribute from BaseApexClass'
                        }
                    ]
                }
            ],
            importantNotes: [
                {
                    title: 'Test Note',
                    content: 'This is a test important note'
                }
            ]
        });
    }
}

class ThrowingGetNodeDetailsAction implements GetNodeDetailsAction {
    exec(_input: GetNodeDetailsInput): Promise<GetNodeDetailsOutput> {
        throw new Error("Error from ThrowingGetNodeDetailsAction");
    }
}

class ErrorGetNodeDetailsAction implements GetNodeDetailsAction {
    exec(input: GetNodeDetailsInput): Promise<GetNodeDetailsOutput> {
        return Promise.resolve({
            status: 'error',
            error: `Engine '${input.engine}' does not support node details or is not yet implemented.`
        });
    }
}

