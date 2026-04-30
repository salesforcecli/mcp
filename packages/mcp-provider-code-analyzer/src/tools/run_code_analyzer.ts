import fs from "node:fs";
import { z }  from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Services, Toolset } from "@salesforce/mcp-provider-api";
import { getMessage } from "../messages.js";
import { getErrorMessage, sanitizePath } from "../utils.js";
import { RunAnalyzerAction, RunAnalyzerActionImpl, RunInput, RunOutput } from "../actions/run-analyzer.js";
import { CodeAnalyzerConfigFactoryImpl } from "../factories/CodeAnalyzerConfigFactory.js";
import { EnginePluginsFactoryImpl } from "../factories/EnginePluginsFactory.js";

const MAX_ALLOWABLE_TARGET_COUNT = 10;

const DESCRIPTION: string = `A tool for performing static analysis against code.
This tool can validate that code conforms to best practices, check for security vulnerabilities, and identify possible
performance issues. It returns a JSON containing the absolute path to a results file if such a file was created,
and a string indicating the overall success or failure of the operation.

When to use this tool:
- When the user asks you to generate files, use this tool to scan those files.
- When the user asks you to check code for problems, use this tool to do that.

REQUIRED INPUT - Directory:
- You MUST provide the "directory" parameter with the absolute path to the project/workspace root.
- The tool will automatically search for code-analyzer.yml or code-analyzer.yaml config files in this directory.
- Config files contain custom rule configurations, severities, and ignore patterns that will be respected.
- If no config file is found in the directory, default configuration will be used.

OPTIONAL - Custom Config Path:
- Use "configPath" parameter only if the config file has a custom name or is in a non-standard location.
- If provided, configPath takes precedence over config files in directory.

Optional: Provide a "selector" to choose which rules to run. Supports:
- Rule names: "WhileLoopsMustUseBraces", "no-unused-vars"
- Engines: "pmd", "eslint", "regex"
- Tags: "Security", "Performance", "Recommended"
- Severities: "Critical", "High", "1", "2"
- Combinations: "Security:pmd", "(Security,Performance):eslint"

Examples:
- "WhileLoopsMustUseBraces" → run specific rule by name
- "Security:pmd" → run Security-tagged PMD rules
- "Critical" → run all Critical-severity rules
- "(Security,Performance):eslint" → ESLint rules tagged Security or Performance

After completion: Use the "query_code_analyzer_results" tool to filter and explain results, e.g., top-N most severe violations or violations by category/tag.`;

export const inputSchema = z.object({
    target: z.array(z.string()).describe(`A JSON-formatted array of between 1 and ${MAX_ALLOWABLE_TARGET_COUNT} files on the users machine that should be scanned. These paths MUST be ABSOLUTE paths, and not relative paths.`),
    directory: z.string().describe(
        `REQUIRED: Absolute path to the workspace/directory. ` +
        `The tool will automatically search for code-analyzer.yml or code-analyzer.yaml config files in this directory. ` +
        `This should typically be the root directory of the project being analyzed.`
    ),
    selector: z.string().optional().describe(
        `Optional selector for Code Analyzer rules. Supports rule names, engines, tags, severities, and combinations. If omitted, "recommended" rules run.\n` +
        `Examples: "WhileLoopsMustUseBraces", "Security:pmd", "Critical", "(Security,Performance):eslint", "pmd:High"`
    ),
    configPath: z.string().optional().describe(
        `Optional absolute path to a Code Analyzer configuration file with a custom name or in a non-standard location. ` +
        `Use this when your config file has a different name or is not in the directory. ` +
        `If provided, this takes precedence over config files found in directory.`
    )
});
type InputArgsShape = typeof inputSchema.shape;

// NOTE: THIS MUST ALIGN WITH THE HARDCODED SCHEMA DEFINED IN `run-analyzer.ts`.
const outputSchema = z.object({
    status: z.string().describe("If the analysis succeeded, then this will be 'success'. Otherwise, it will be an error message."),
    resultsFile: z.string().optional().describe(`The absolute path of the file to which results were written. Read from this file to get those results.`),
    summary: z.object({
        total: z.number().optional().describe('The total number of violations that are present in the results file. Will be equal to the sum of all violations across all severities.'),
        sev1: z.number().optional().describe('The number of severity 1 violations that are present in the results file.'),
        sev2: z.number().optional().describe('The number of severity 2 violations that are present in the results file.'),
        sev3: z.number().optional().describe('The number of severity 3 violations that are present in the results file.'),
        sev4: z.number().optional().describe('The number of severity 4 violations that are present in the results file.'),
        sev5: z.number().optional().describe('The number of severity 5 violations that are present in the results file.')
    }).optional().describe('An object describing the number of violations of each severity, as well as the total number of violations.')
});
type OutputArgsShape = typeof outputSchema.shape;


export class CodeAnalyzerRunMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
    public static readonly NAME: string = 'run_code_analyzer';
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

    public getReleaseState(): ReleaseState {
        return ReleaseState.GA;
    }

    public getToolsets(): Toolset[] {
        return [Toolset.CODE_ANALYSIS];
    }

    public getName(): string {
        return CodeAnalyzerRunMcpTool.NAME;
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
        try {
            validateInput(input);

            const unsupportedEngineError: CallToolResult | null = rejectUnsupportedEnginesIfPresent(input.selector);
            if (unsupportedEngineError) {
                return unsupportedEngineError;
            }

            const output: RunOutput = await this.action.exec(input);
            return {
                content: [{ type: "text", text: JSON.stringify(output) }],
                structuredContent: output
            };
        } catch (e) {
            const output: RunOutput = { status: getErrorMessage(e) };
            return {
                content: [{ type: "text", text: JSON.stringify(output) }],
                structuredContent: output
            };
        }
    }
}

function selectorIncludesEngine(selectorLower: string, engineLower: 'sfge' | 'flow'): boolean {
    // Match token boundaries: start or one of "(:," before, and end or one of ":),"
    const pattern = new RegExp(`(^|[(:,])\\s*${engineLower}\\s*(?=[:),]|$)`, 'i');
    return pattern.test(selectorLower);
}

function rejectUnsupportedEnginesIfPresent(selector: string | undefined): CallToolResult | null {
    if (!selector || selector.trim().length === 0) {
        return null;
    }
    const sel = selector.trim().toLowerCase();
    const unsupported: string[] = [];
    if (selectorIncludesEngine(sel, 'sfge')) unsupported.push('sfge');
    if (selectorIncludesEngine(sel, 'flow')) unsupported.push('flow');
    if (unsupported.length === 0) {
        return null;
    }
    const msg = `Unsupported engine(s) for this tool: ${unsupported.join(', ')}. Please remove them from the selector.`;
    return makeErrorResult(msg);
}

function makeErrorResult(message: string): CallToolResult {
    const structured = { status: message };
    return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify(structured) }],
        structuredContent: structured
    };
}

function validateInput(input: RunInput): void {
    if (input.target.length === 0) {
        throw new Error(getMessage('targetArrayCannotBeEmpty'));
    }
    if (input.target.length > MAX_ALLOWABLE_TARGET_COUNT) {
        throw new Error(getMessage('tooManyTargets', input.target.length, MAX_ALLOWABLE_TARGET_COUNT));
    }

    // Validate directory path
    if (!sanitizePath(input.directory)) {
        throw new Error(`Invalid directory path: ${input.directory}. Path must be absolute and not contain traversal sequences.`);
    }

    // Validate configPath if provided
    if (input.configPath && !sanitizePath(input.configPath)) {
        throw new Error(`Invalid config path: ${input.configPath}. Path must be absolute and not contain traversal sequences.`);
    }

    // Validate target paths
    for (const entry of input.target) {
        if (!sanitizePath(entry)) {
            throw new Error(`Invalid target path: ${entry}. Path must be absolute and not contain traversal sequences.`);
        }
        if (!fs.existsSync(entry)) {
            throw new Error(getMessage('allTargetsMustExist', entry));
        }
        if (fs.statSync(entry).isDirectory()) {
            throw new Error(getMessage('targetsCannotBeDirectories', entry));
        }
    }
}
