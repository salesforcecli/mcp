import path from "node:path";
import { fileURLToPath } from "url";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpToolConfig, ReleaseState, Toolset } from "@salesforce/mcp-provider-api";
import { CodeAnalyzerRunMcpTool } from "../../src/tools/run_code_analyzer.js";
import { RunAnalyzerAction, RunInput, RunOutput } from "../../src/actions/run-analyzer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PATH_TO_SAMPLE_TARGETS: string = path.resolve(__dirname, '..', 'fixtures', 'sample-targets');

describe("Tests for CodeAnalyzerRunMcpTool", () => {
    let tool: CodeAnalyzerRunMcpTool;

    beforeEach(() => {
        tool = new CodeAnalyzerRunMcpTool();
    });

    it("When getReleaseState is called, then 'ga' is returned", () => {
        expect(tool.getReleaseState()).toEqual(ReleaseState.GA);
    })

    it("When getToolsets is called, then 'code-analysis' is returned", () => {
        expect(tool.getToolsets()).toEqual([Toolset.CODE_ANALYSIS]);
    });

    it("When getName is called, then tool name is returned", () => {
        expect(tool.getName()).toEqual('run_code_analyzer');
    });

    it("When getConfig is called, then the correct configuration is returned", () => {
        const config: McpToolConfig = tool.getConfig();
        expect(config.title).toEqual('Run Code Analyzer');
        expect(config.description).toContain('A tool for performing static analysis against code.');
        expect(config.inputSchema).toBeTypeOf('object');
        expect(Object.keys(config.inputSchema as object).sort()).toEqual(['selector', 'target']);
        expect(config.outputSchema).toBeTypeOf('object');
        expect(Object.keys(config.outputSchema as object)).toEqual(['status', 'resultsFile', 'summary']);
        expect(config.annotations).toEqual({readOnlyHint: false});
    });

    describe('Tests for exec method', () => {
        const sampleTargets: string[] = [
            path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget1.cls'),
            path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget2.cls'),
            path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget3.cls'),
            path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget4.cls'),
            path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget5.cls'),
            path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget6.cls'),
            path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget7.cls'),
            path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget8.cls'),
            path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget9.cls'),
            path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget10.cls'),
            path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget11.cls'),
            path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget12.cls'),
            path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget13.cls')
        ];

        it("When exec is called with valid inputs, then action is called with expected inputs", async () => {
            const spyAction: SpyRunAction = new SpyRunAction();
            tool = new CodeAnalyzerRunMcpTool(spyAction);

            const result: CallToolResult = await tool.exec({target: sampleTargets.slice(0, 5)});

            expect(spyAction.execCallHistory).toHaveLength(1);
            expect(spyAction.execCallHistory[0].target).toEqual(sampleTargets.slice(0, 5));

            const expectedOutput: RunOutput = {
                status: "Spy successfully invoked"
            }
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toEqual("text");
            expect(result.content[0].text).toEqual(JSON.stringify(expectedOutput));
            expect(result.structuredContent).toEqual(expectedOutput);
        });

        it.each([
            {
                case: 'paths to files that do not exist',
                args: {
                    target: [path.join(PATH_TO_SAMPLE_TARGETS, 'beep.cls')]
                },
                keyErrorPhrase: "must exist"
            },
            {
                case: 'paths to directories',
                args: {
                    target: [PATH_TO_SAMPLE_TARGETS]
                },
                keyErrorPhrase: "must be files"
            },
            {
                case: 'lists in excess of 10 entries',
                args: {
                    target: sampleTargets
                },
                keyErrorPhrase: "maximum allowable length of 10"
            },
            {
                case: 'empty lists',
                args: {
                    target: []
                },
                keyErrorPhrase: "non-empty"
            }
        ])("When invalid input is given ($case), then return error result", async ({args, keyErrorPhrase}) => {
            const result: CallToolResult = await tool.exec(args as RunInput)

            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toEqual("text");
            expect(result.content[0].text).toContain(keyErrorPhrase);
            expect(result.structuredContent).toBeDefined();
            expect((result.structuredContent  as RunOutput).status).toContain(keyErrorPhrase);
        });

        it('When action throws error, then return error result', async () => {
            const throwingAction: ThrowingRunAction = new ThrowingRunAction();
            tool = new CodeAnalyzerRunMcpTool(throwingAction);

            const result: CallToolResult = await tool.exec({target: sampleTargets.slice(0, 5)});

            const expectedOutput: RunOutput = {
                status: "Error from ThrowingRunAction"
            }
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toEqual("text");
            expect(result.content[0].text).toEqual(JSON.stringify(expectedOutput));
            expect(result.structuredContent).toEqual(expectedOutput);
        });

        it('When selector has invalid tokens, then return validation error (no action call)', async () => {
            const spyAction: SpyRunAction = new SpyRunAction();
            tool = new CodeAnalyzerRunMcpTool(spyAction);
            const result: CallToolResult = await tool.exec({
                target: [path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget1.cls')],
                selector: 'NotATag:9999'
            } as RunInput);
            expect(result.isError).toBe(true);
            expect(result.structuredContent?.status).toContain('Invalid selector token(s):');
            // Ensure action was not invoked
            expect(spyAction.execCallHistory).toHaveLength(0);
        });

        it.each([
            { selector: 'sfge:Security', engine: 'sfge' },
            { selector: 'flow:High', engine: 'flow' },
            { selector: '(Security,sfge)', engine: 'sfge' },
            { selector: 'pmd:(Performance,flow):2', engine: 'flow' },
        ])('When selector includes unsupported engine ($engine), return error', async ({ selector }) => {
            const spyAction: SpyRunAction = new SpyRunAction();
            tool = new CodeAnalyzerRunMcpTool(spyAction);
            const result: CallToolResult = await tool.exec({
                target: [path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget1.cls'), path.join(PATH_TO_SAMPLE_TARGETS, 'ApexTarget2.cls')],
                selector
            } as RunInput);
            expect(result.isError).toBe(true);
            expect(result.structuredContent?.status).toContain('Unsupported engine(s) for this tool');
            // Ensure action was not invoked
            expect(spyAction.execCallHistory).toHaveLength(0);
        });
    });
});

class SpyRunAction implements RunAnalyzerAction {
    public execCallHistory: RunInput[] = [];
    public exec(input: RunInput): Promise<RunOutput> {
        this.execCallHistory.push(input);
        return Promise.resolve({
            status: 'Spy successfully invoked'
        });
    }
}

class ThrowingRunAction implements RunAnalyzerAction {
    exec(_input: RunInput): Promise<RunOutput> {
        throw new Error("Error from ThrowingRunAction");
    }
}
