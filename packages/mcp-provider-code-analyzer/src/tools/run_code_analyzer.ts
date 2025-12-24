import fs from "node:fs";
import { z }  from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Services, Toolset } from "@salesforce/mcp-provider-api";
import { getMessage } from "../messages.js";
import { getErrorMessage } from "../utils.js";
import { RunAnalyzerAction, RunAnalyzerActionImpl, RunInput, RunOutput } from "../actions/run-analyzer.js";
import { CodeAnalyzerListRulesMcpTool } from "./list_code_analyzer_rules.js";
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
    `Optional: Provide a "selector" (same semantics as "list_code_analyzer_rules") to choose which rules to run.\n` +
    `Examples:\n` +
    `- "Security:pmd" → run Security-tagged PMD rules\n` +
    `- "Critical" → run all Critical-severity rules\n` +
    `- "(Security,Performance):eslint" → ESLint rules tagged Security or Performance\n` +
    `\n` +
    `After completion: Use the "query_code_analyzer_results" tool to filter and explain results, e.g., top-N most severe violations or violations by category/tag.`;

export const inputSchema = z.object({
    target: z.array(z.string()).describe(`A JSON-formatted array of between 1 and ${MAX_ALLOWABLE_TARGET_COUNT} files on the users machine that should be scanned. These paths MUST be ABSOLUTE paths, and not relative paths.`),
    selector: z.string().describe(
        `A selector for Code Analyzer rules. Must meet the criteria outlined in the tool-level description.\n` +
        `Examples:\n` +
        `- "Security:pmd"\n` +
        `- "Critical"\n` +
        `- "(Security,Performance):eslint"\n` +
        `- "pmd:High"`
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
        return ReleaseState.NON_GA;
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

            const selectorValidationError: CallToolResult | null = validateSelectorIfProvided(input.selector);
            if (selectorValidationError) {
                return selectorValidationError;
            }

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

function validateSelectorIfProvided(selector: string | undefined): CallToolResult | null {
    if (!selector || selector.trim().length === 0) {
        return null;
    }
    const validation = CodeAnalyzerListRulesMcpTool.validateSelector(selector);
    if (validation.valid === false) {
        const msg = `Invalid selector token(s): ${validation.invalidTokens.join(', ')}`;
        return makeErrorResult(msg);
    }
    return null;
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
    for (const entry of input.target) {
        if (!fs.existsSync(entry)) {
            throw new Error(getMessage('allTargetsMustExist', entry));
        }
        if (fs.statSync(entry).isDirectory()) {
            throw new Error(getMessage('targetsCannotBeDirectories', entry));
        }
    }
}
