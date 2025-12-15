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
    `After completion, this tool will summarize and explain the filtered results to the user.`;

export const inputSchema = z.object({
    resultsFile: z.string().describe("Absolute path to a results JSON file produced by the code analyzer., if results file is not provided, call run_code_analyzer tool to generate a results file first."),
    selector: z.string().describe('Selector (same semantics as "list_code_analyzer_rules"): colon-separated tokens with optional OR-groups in parentheses, e.g., "Security:(pmd,eslint):High".'),
    topN: z.number().int().positive().max(1000).default(5).describe("Return at most this many violations after filtering and sorting (default 5).")
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
                topN: input.topN
            } as QueryResultsInput);
            emitQueryTelemetry(this.telemetryService, {
                resultsFile: output.resultsFile ?? path.resolve(input.resultsFile),
                selector: input.selector,
                sortBy: 'severity',
                sortDirection: 'asc',
                topN: input.topN ?? 5,
                totalViolations: output.totalViolations ?? 0,
                totalMatches: output.totalMatches ?? 0
            });
            return {
                content: [{ type: "text", text: JSON.stringify(output) }],
                structuredContent: output
            };
        } catch (e) {
            const output = { status: getErrorMessage(e) };
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
    sortBy: 'severity'|'rule'|'engine'|'file'|'none';
    sortDirection: 'asc'|'desc';
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
        sortBy: data.sortBy,
        sortDirection: data.sortDirection,
        totalViolations: data.totalViolations,
        totalMatches: data.totalMatches,
        selector: data.selector
    };
    telemetryService.sendEvent(Constants.TelemetryEventName, telemetry);
}

function validateInput(input: z.infer<typeof inputSchema>): void {
    if (!path.isAbsolute(input.resultsFile)) {
        throw new Error(`resultsFile must be an absolute path: ${input.resultsFile}`);
    }
    // Existence will be validated by the action while reading
}