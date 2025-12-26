import os from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { CodeAnalyzerQueryResultsMcpTool } from "../../src/tools/query_code_analyzer_results.js";
import type { QueryResultsAction, QueryResultsInput, QueryResultsOutput } from "../../src/actions/query-results.js";
import { SpyTelemetryService, type SendTelemetryEvent } from "../test-doubles.js";

class StubQueryResultsAction implements QueryResultsAction {
  public lastInput: QueryResultsInput | undefined;
  public output: QueryResultsOutput;
  public constructor(output?: QueryResultsOutput) {
    this.output = output ?? {
      status: "success",
      resultsFile: "/abs/path/results.json",
      totalViolations: 10,
      totalMatches: 3,
      violations: []
    };
  }
  async exec(input: QueryResultsInput): Promise<QueryResultsOutput> {
    this.lastInput = input;
    return this.output;
  }
}

describe("CodeAnalyzerQueryResultsMcpTool", () => {
  it("exposes metadata (name, release state, toolsets, config)", () => {
    const tool = new CodeAnalyzerQueryResultsMcpTool(new StubQueryResultsAction());
    expect(tool.getName()).toBe("query_code_analyzer_results");
    expect(tool.getReleaseState()).toBeDefined();
    expect(tool.getToolsets()).toContain("code-analysis");
    const cfg = tool.getConfig();
    expect(cfg.title).toBeDefined();
    expect(cfg.description).toContain("Query a Code Analyzer results JSON file");
    expect(cfg.inputSchema).toBeDefined();
    expect(cfg.outputSchema).toBeDefined();
    expect(cfg.annotations?.readOnlyHint).toBe(true);
  });
  it("parses selector to filters and calls action with defaults (topN=5, sortBy severity asc)", async () => {
    const stubAction = new StubQueryResultsAction();
    const telemetry = new SpyTelemetryService();
    const tool = new CodeAnalyzerQueryResultsMcpTool(stubAction, telemetry);
    const absResultsFile = path.join(os.tmpdir(), "dummy-results.json"); // only needs to be absolute
    const selector = "pmd:(Security,Performance):1";

    const res = await tool.exec({ resultsFile: absResultsFile, selector, topN: 5 });
    expect(res.structuredContent?.status).toBe("success");
    // Action received parsed filters and topN defaulted to 5
    expect(stubAction.lastInput).toBeDefined();
    const input = stubAction.lastInput!;
    expect(input.topN).toBe(5);
    expect(input.filters.engines).toEqual(["pmd"]);
    expect(new Set(input.filters.tags)).toEqual(new Set(["security","performance"]));
    expect(input.filters.severities).toEqual([1]);

    // Telemetry emitted
    const events: SendTelemetryEvent[] = telemetry.sendEventCallHistory;
    expect(events.length).toBe(1);
    expect(events[0].event.sfcaEvent).toBe("results_query");
    expect(events[0].event.selector).toBe(selector);
    expect(events[0].event.topN).toBe(5);
  });

  it("uses default action when none is provided to constructor", () => {
    const tool = new CodeAnalyzerQueryResultsMcpTool();
    expect(tool.getName()).toBe("query_code_analyzer_results");
  });

  it("returns isError with message for invalid selector", async () => {
    const stubAction = new StubQueryResultsAction();
    const tool = new CodeAnalyzerQueryResultsMcpTool(stubAction);
    const absResultsFile = path.join(os.tmpdir(), "dummy-results.json");

    const res = await tool.exec({ resultsFile: absResultsFile, selector: "NotATag:9999", topN: 5 });
    expect(res.isError).toBe(true);
    expect(typeof res.structuredContent?.status).toBe("string");
    expect(res.structuredContent?.status).toContain("Invalid selector token");
  });

  it("emits telemetry using fallback values when action omits resultsFile and counts", async () => {
    const output: QueryResultsOutput = {
      status: "success"
    };
    const stubAction = new StubQueryResultsAction(output);
    const telemetry = new SpyTelemetryService();
    const tool = new CodeAnalyzerQueryResultsMcpTool(stubAction, telemetry);
    const absResultsFile = path.join(os.tmpdir(), "dummy-results.json");
    const res = await tool.exec({ resultsFile: absResultsFile, selector: "Security", topN: 5 });
    expect(res.structuredContent?.status).toBe("success");
    const events: SendTelemetryEvent[] = telemetry.sendEventCallHistory;
    expect(events.length).toBe(1);
    expect(events[0].event.resultsFile).toBe(path.resolve(absResultsFile));
    expect(events[0].event.topN).toBe(5);
    expect(events[0].event.totalViolations).toBe(0);
    expect(events[0].event.totalMatches).toBe(0);
  });

  it("falls back to default topN=5 when not provided (telemetry path)", async () => {
    const stubAction = new StubQueryResultsAction({
      status: "success",
      totalViolations: undefined,
      totalMatches: undefined,
      violations: []
    });
    const telemetry = new SpyTelemetryService();
    const tool = new CodeAnalyzerQueryResultsMcpTool(stubAction, telemetry);
    const absResultsFile = path.join(os.tmpdir(), "dummy-results.json");
    // Intentionally omit topN by casting to any to exercise nullish-coalescing fallback
    const res = await tool.exec({ resultsFile: absResultsFile, selector: "Security" } as any);
    expect(res.structuredContent?.status).toBe("success");
    const events: SendTelemetryEvent[] = telemetry.sendEventCallHistory;
    expect(events.length).toBe(1);
    expect(events[0].event.topN).toBe(5);
  });

  it("rejects relative resultsFile path", async () => {
    const stubAction = new StubQueryResultsAction();
    const tool = new CodeAnalyzerQueryResultsMcpTool(stubAction);
    const relPath = "relative/results.json";

    const res = await tool.exec({ resultsFile: relPath, selector: "Security", topN: 5 });
    expect(res.isError).toBe(true);
    expect(res.structuredContent?.status).toContain("resultsFile must be an absolute path");
  });

  it("wraps action output into content and structuredContent", async () => {
    const expected: QueryResultsOutput = {
      status: "success",
      resultsFile: "/abs/path/out.json",
      totalViolations: 7,
      totalMatches: 2,
      violations: []
    };
    const stubAction = new StubQueryResultsAction(expected);
    const tool = new CodeAnalyzerQueryResultsMcpTool(stubAction);
    const absResultsFile = path.join(os.tmpdir(), "dummy-results.json");
    const res = await tool.exec({ resultsFile: absResultsFile, selector: "Security", topN: 5 });
    expect(res.structuredContent).toEqual(expected);
    expect(typeof res.content?.[0]?.text).toBe("string");
    const text: string = typeof res.content?.[0]?.text === "string"
      ? (res.content![0] as any).text as string
      : JSON.stringify(res.structuredContent ?? {});
    const parsed = JSON.parse(text) as unknown as QueryResultsOutput;
    expect(parsed).toEqual(expected);
  });
});


