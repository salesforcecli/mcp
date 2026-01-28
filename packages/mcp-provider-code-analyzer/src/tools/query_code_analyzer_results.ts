import path from "node:path";
import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, TelemetryService, TelemetryEvent } from "@salesforce/mcp-provider-api";
import { getErrorMessage } from "../utils.js";
import * as Constants from "../constants.js";
import { QueryResultsAction, QueryResultsActionImpl, QueryResultsInput, QueryResultsOutput } from "../actions/query-results.js";
import { validateSelectorForQuery, parseSelectorToFilters } from "../selector.js";

const DESCRIPTION: string =
    `Query a Code Analyzer results JSON file and return filtered violations.\n` +
    `Supports filters like severity, category/tag, engine, rule, and file name, plus top-N and sorting.\n` +
    `Use this after running "run_code_analyzer" to read the generated results file.\n` +
    `After completion, this tool will summarize and explain the filtered results to the user.\n` +
    `\n` +
    `Examples (natural language → selector/topN):\n` +
    `- "Top 5 security in PMD" → selector: "Security:pmd", topN: 5\n` +
    `- "Top 10 critical" → selector: "Critical", topN: 10\n` +
    `- "Top 5 security or performance in ESLint" → selector: "(Security,Performance):eslint", topN: 5\n` +
    `- "Top 5 PMD High severity" → selector: "pmd:High", topN: 5\n` +
    `- "Top 5 for rule MyRuleName" → selector: "rule=MyRuleName", topN: 5\n` +
    `- "Top 5 in files under src/app" → selector: "file=src/app", topN: 5\n`;

export const inputSchema = z.object({
    resultsFile: z.string().describe("Absolute path to a results JSON file produced by the code analyzer., if results file is not provided, call run_code_analyzer tool to generate a results file first."),
    selector: z.string().describe('Selector (same semantics as "list_code_analyzer_rules"): colon-separated tokens with optional OR-groups in parentheses, e.g., "Security:(pmd,eslint):High".'),
    topN: z.number().int().positive().max(1000).default(5).describe("Return at most this many violations after filtering and sorting (default 5)."),
    sortBy: z.enum(['severity', 'rule', 'engine', 'file', 'none']).optional().describe("Optional primary sort field."),
    sortDirection: z.enum(['asc', 'desc']).optional().describe("Optional sort direction.")
});
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
    status: z.string().describe('If the operation succeeds, this will be "success". Otherwise, it will be an error message.'),
    resultsFile: z.string().optional().describe('Echoes the analyzed results file path.'),
    totalViolations: z.number().optional().describe('Total violations present in the results file.'),
    totalMatches: z.number().optional().describe('Total violations matching the provided filters (before topN).'),
    violations: z.array(z.object({
        rule: z.string(),
        engine: z.string(),
        severity: z.number(),
        severityName: z.string(),
        tags: z.array(z.string()),
        message: z.string(),
        primaryLocation: z.object({
            file: z.string().optional(),
            startLine: z.number().optional(),
            startColumn: z.number().optional()
        }),
        resources: z.array(z.string()).optional()
    })).optional().describe('Filtered/sorted violations (capped by topN).')
});
type OutputArgsShape = typeof outputSchema.shape;

export class CodeAnalyzerQueryResultsMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
    public static readonly NAME: string = 'query_code_analyzer_results';
    private readonly action: QueryResultsAction;
    private readonly telemetryService?: TelemetryService;

    public constructor(
        action: QueryResultsAction = new QueryResultsActionImpl(),
        telemetryService?: TelemetryService
    ) {
        super();
        this.action = action;
        this.telemetryService = telemetryService;
    }

    public getReleaseState(): ReleaseState {
        // TODO: Change to GA when ready
        return ReleaseState.NON_GA;
    }

    public getToolsets(): Toolset[] {
        return [Toolset.CODE_ANALYSIS];
    }

    public getName(): string {
        return CodeAnalyzerQueryResultsMcpTool.NAME;
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Query Code Analyzer Results",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: outputSchema.shape,
            annotations: {
                readOnlyHint: true
            }
        };
    }

    public async exec(input: z.infer<typeof inputSchema>): Promise<CallToolResult> {
        try {
            validateInput(input);
            // Validate selector similarly to list-rules tool
            const validation = validateSelectorForQuery(input.selector);
            if (validation.valid === false) {
                const msg = `Invalid selector token(s): ${validation.invalidTokens.join(', ')}`;
                const output = { status: msg };
                return {
                    isError: true,
                    content: [{ type: "text", text: JSON.stringify(output) }],
                    structuredContent: output
                };
            }
            const filters = parseSelectorToFilters(input.selector);
            const output: QueryResultsOutput = await this.action.exec({
                resultsFile: input.resultsFile,
                filters,
                topN: input.topN,
                sortBy: input.sortBy,
                sortDirection: input.sortDirection
            } as QueryResultsInput);
            emitQueryTelemetry(this.telemetryService, {
                resultsFile: output.resultsFile ?? path.resolve(input.resultsFile),
                selector: input.selector,
                sortBy: input.sortBy,
                sortDirection: input.sortDirection,
                topN: input.topN ?? 5,
                totalViolations: output.totalViolations ?? 0,
                totalMatches: output.totalMatches ?? 0
            });
            return {
                content: [{ type: "text", text: JSON.stringify(output) }],
                structuredContent: output
            };
        } catch (e) {
            const errMsg = getErrorMessage(e);
            // Emit failure telemetry on unexpected errors
            if (this.telemetryService) {
                this.telemetryService.sendEvent(Constants.TelemetryEventName, {
                    source: Constants.TelemetrySource,
                    sfcaEvent: Constants.McpTelemetryEvents.RESULTS_QUERY,
                    outcome: 'failure',
                    error: errMsg
                });
            }
            const output = { status: errMsg };
            return {
                isError: true,
                content: [{ type: "text", text: JSON.stringify(output) }],
                structuredContent: output
            };
        }
    }
}

type QueryTelemetry = {
    resultsFile: string;
    selector?: string;
    sortBy?: 'severity'|'rule'|'engine'|'file'|'none';
    sortDirection?: 'asc'|'desc';
    topN: number;
    totalViolations: number;
    totalMatches: number;
};

function emitQueryTelemetry(telemetryService: TelemetryService | undefined, data: QueryTelemetry): void {
    if (!telemetryService) return;
    const telemetry: TelemetryEvent = {
        source: Constants.TelemetrySource,
        sfcaEvent: Constants.McpTelemetryEvents.RESULTS_QUERY,
        resultsFile: data.resultsFile,
        topN: data.topN,
        totalViolations: data.totalViolations,
        totalMatches: data.totalMatches,
        selector: data.selector
    };
    if (data.sortBy) (telemetry as any).sortBy = data.sortBy;
    if (data.sortDirection) (telemetry as any).sortDirection = data.sortDirection;
    telemetryService.sendEvent(Constants.TelemetryEventName, telemetry);
}

function validateInput(input: z.infer<typeof inputSchema>): void {
    if (!path.isAbsolute(input.resultsFile)) {
        throw new Error(`resultsFile must be an absolute path: ${input.resultsFile}`);
    }
    // Existence will be validated by the action while reading
}