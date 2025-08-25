import fs from "node:fs";
import { z }  from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, Toolset } from "@salesforce/mcp-provider-api";
import { getMessage } from "../messages.js";
import { getErrorMessage } from "../utils.js";
import { RunAnalyzerAction, RunAnalyzerActionImpl, RunInput, RunOutput } from "../actions/run-analyzer.js";
import { CodeAnalyzerConfigFactoryImpl } from "../factories/CodeAnalyzerConfigFactory.js";
import { EnginePluginsFactoryImpl } from "../factories/EnginePluginsFactory.js";

const MAX_ALLOWABLE_TARGET_COUNT = 10;

const DESCRIPTION: string = `A tool for performing static analysis against code.\n` +
    `This tool can validate that code conforms to best practices, check for security vulnerabilities, and identify possible\n` +
    `performance issues. It returns a JSON containing the absolute path to a results file if such a file was created,\n` +
    `and a string indicating the overall success or failure of the operation.\n` +
    `\n` +
    `When to use this tool:\n` +
    `- When the user asks you to generate files, use this tool to scan those files.\n` +
    `- When the user asks you to check code for problems, use this tool to do that.\n` +
    `\n` +
    `Parameters explained:\n` +
    `- target: An Array of absolute paths to files that should be scanned.\n` +
    `  * This list MUST include files, and CANNOT include directories or globs.\n` +
    `  * ALL files included in this array must actually exist on the user's machine.\n` +
    `  * The array MUST be non-empty.\n` +
    `  * The array can contain a MAXIMUM of ${MAX_ALLOWABLE_TARGET_COUNT} entries. If there are more than ten files to scan, the tool should be called multiple times.\n` +
    `\n` +
    `Output explained:\n` +
    `- status: A string indicating whether the operation as a whole was successful.\n` +
    `  * In a successful run, this will be "success".\n` +
    `  * In a failed run, this will be an error message.\n` +
    `- resultsFile: The absolute path to the results file. Read from this file to see what violations were found in the\n` +
    `  target files, so that either you or the user can fix them.\n` +
    `  * If the analysis finished successfully, this property will be present.\n` +
    `  * If the analysis failed, then this property will be absent.\n`;

const inputSchema = z.object({
    target: z.array(z.string()).describe(`A JSON-formatted array of between 1 and ${MAX_ALLOWABLE_TARGET_COUNT} files on the users machine that should be scanned.`)
});
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
    status: z.string().describe("If the analysis succeeded, then this will be 'success'. Otherwise, it will be an error message."),
    resultsFile: z.string().optional().describe(`The absolute path of the file to which results were written. Read from this file to get those results.`),
});
type OutputArgsShape = typeof outputSchema.shape;


export class CodeAnalyzerRunMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
    private readonly action: RunAnalyzerAction;

    public constructor(
        action: RunAnalyzerAction = new RunAnalyzerActionImpl({
            configFactory: new CodeAnalyzerConfigFactoryImpl(),
            enginePluginsFactory: new EnginePluginsFactoryImpl()
        })
    ) {
        super();
        this.action = action;
    }

    public getToolsets(): Toolset[] {
        return [Toolset.EXPERIMENTAL];
    }

    public getName(): string {
        return "sf-code-analyzer-run"; 
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Run Code Analyzer",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: outputSchema.shape,
            annotations: {
                readOnlyHint: false
            }
        };
    }

    public async exec(input: RunInput): Promise<CallToolResult> {
        let output: RunOutput;
        try {
            validateInput(input);
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

function validateInput(input: RunInput): void {
    if (input.target.length === 0) {
        throw new Error(getMessage('targetArrayCannotBeEmpty'));
    }
    if (input.target.length > MAX_ALLOWABLE_TARGET_COUNT) {
        throw new Error(getMessage('tooManyTargets', input.target.length, MAX_ALLOWABLE_TARGET_COUNT));
    }
    for (const entry of input.target) {
        if (!fs.existsSync(entry)) {
            throw new Error(getMessage('allTargetsMustExist', entry));
        }
        if (fs.statSync(entry).isDirectory()) {
            throw new Error(getMessage('targetsCannotBeDirectories', entry));
        }
    }
}