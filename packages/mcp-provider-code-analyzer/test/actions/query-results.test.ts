import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { QueryResultsActionImpl, type QueryResultsInput, type QueryResultsOutput } from "../../src/actions/query-results.js";
import { type QueryFilters } from "../../src/entities/query.js";

function writeResultsJson(tmpDir: string, name: string, payload: unknown): string {
  const file = path.join(tmpDir, name);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
  return file;
}

function makeViolation(partial: Partial<{
  rule: string;
  engine: string;
  severity: number;
  tags: string[];
  file?: string;
  message?: string;
}>): any {
  const file = partial.file ?? "/workspace/src/app/Foo.ts";
  return {
    rule: partial.rule ?? "test.rule",
    engine: partial.engine ?? "pmd",
    severity: partial.severity ?? 3,
    tags: partial.tags ?? ["Security"],
    primaryLocationIndex: 0,
    locations: [{ file, startLine: 1, startColumn: 1 }],
    message: partial.message ?? "Test message",
    resources: []
  };
}

function makeResults(violations: any[]): any {
  return {
    runDir: "/workspace",
    violationCounts: {
      total: violations.length,
      sev1: violations.filter(v => v.severity === 1).length,
      sev2: violations.filter(v => v.severity === 2).length,
      sev3: violations.filter(v => v.severity === 3).length,
      sev4: violations.filter(v => v.severity === 4).length,
      sev5: violations.filter(v => v.severity === 5).length
    },
    versions: { core: "0.0.0" },
    violations
  };
}

describe("QueryResultsActionImpl", () => {
  const action = new QueryResultsActionImpl();

  it("filters by severity and limits to topN with severity sort", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfca-query-"));
    const violations = [
      makeViolation({ severity: 3 }),
      makeViolation({ severity: 1 }),
      makeViolation({ severity: 2 }),
      makeViolation({ severity: 1 }),
      makeViolation({ severity: 5 })
    ];
    const file = writeResultsJson(tmp, "results.json", makeResults(violations));

    const filters: QueryFilters = {
      engines: [],
      severities: [1],
      tags: [],
      rules: [],
      fileContains: [],
      fileEndsWith: []
    };
    const input: QueryResultsInput = {
      resultsFile: file,
      filters,
      topN: 1 // request only one item
    };
    const out: QueryResultsOutput = await action.exec(input);
    expect(out.status).toEqual("success");
    expect(out.totalMatches).toBe(2); // there are two severity 1 matches
    expect(out.violations?.length).toBe(1);
    expect(out.violations?.[0].severity).toBe(1);
    expect(out.violations?.[0].severityName).toBe("Critical");
  });

  it("filters by engine and tag (category)", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfca-query-"));
    const violations = [
      makeViolation({ engine: "pmd", tags: ["Security"] }),
      makeViolation({ engine: "eslint", tags: ["Performance"] }),
      makeViolation({ engine: "pmd", tags: ["Performance"] })
    ];
    const file = writeResultsJson(tmp, "results.json", makeResults(violations));

    const filters: QueryFilters = {
      engines: ["pmd"],
      severities: [],
      tags: ["security"], // case-insensitive
      rules: [],
      fileContains: [],
      fileEndsWith: []
    };
    const out = await action.exec({ resultsFile: file, filters });
    expect(out.status).toEqual("success");
    expect(out.totalMatches).toBe(1);
    expect(out.violations?.length).toBe(1);
    expect(out.violations?.[0].engine).toBe("pmd");
    expect(out.violations?.[0].tags.map(t => t.toLowerCase())).toContain("security");
  });

  it("filters by exact rule name", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfca-query-"));
    const violations = [
      makeViolation({ rule: "my.rule", engine: "pmd" }),
      makeViolation({ rule: "other.rule", engine: "pmd" })
    ];
    const file = writeResultsJson(tmp, "results.json", makeResults(violations));
    const out = await action.exec({
      resultsFile: file,
      filters: {
        engines: [],
        severities: [],
        tags: [],
        rules: ["my.rule"],
        fileContains: [],
        fileEndsWith: []
      }
    });
    expect(out.status).toEqual("success");
    expect(out.totalMatches).toBe(1);
    expect(out.violations?.[0].rule).toBe("my.rule");
  });

  it("filters by fileContains and fileEndsWith", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfca-query-"));
    const violations = [
      makeViolation({ file: "/workspace/src/app/Foo.ts" }),
      makeViolation({ file: "/workspace/src/lib/Bar.ts" }),
      makeViolation({ file: "/workspace/src/app/sub/Baz.ts" })
    ];
    const file = writeResultsJson(tmp, "results.json", makeResults(violations));
    const out = await action.exec({
      resultsFile: file,
      filters: {
        engines: [],
        severities: [],
        tags: [],
        rules: [],
        fileContains: ["src/app/"],
        fileEndsWith: ["Baz.ts"]
      }
    });
    // Must match both constraints (AND across categories)
    expect(out.status).toEqual("success");
    expect(out.totalMatches).toBe(1);
    expect(out.violations?.length).toBe(1);
    expect(out.violations?.[0].primaryLocation.file?.endsWith("Baz.ts")).toBe(true);
  });

  it("returns empty violations when no filters match", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfca-query-"));
    const violations = [
      makeViolation({ severity: 2 }),
      makeViolation({ severity: 3 })
    ];
    const file = writeResultsJson(tmp, "results.json", makeResults(violations));
    const out = await action.exec({
      resultsFile: file,
      filters: {
        engines: ["eslint"],
        severities: [1],
        tags: ["security"],
        rules: ["nonexistent.rule"],
        fileContains: ["does-not-exist"],
        fileEndsWith: ["missing.ts"]
      }
    });
    expect(out.status).toEqual("success");
    expect(out.totalMatches).toBe(0);
    expect(out.violations?.length).toBe(0);
  });

  it("handles results with no violations array (fallback to empty) and preserves totalViolations", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfca-query-"));
    const payload = {
      runDir: "/workspace",
      violationCounts: { total: 2, sev1: 1, sev2: 1, sev3: 0, sev4: 0, sev5: 0 },
      versions: { core: "0.0.0" }
      // violations intentionally omitted
    };
    const file = writeResultsJson(tmp, "results.json", payload);
    const out = await action.exec({
      resultsFile: file,
      filters: { engines: [], severities: [], tags: [], rules: [], fileContains: [], fileEndsWith: [] },
      topN: 10
    });
    expect(out.status).toEqual("success");
    expect(out.totalViolations).toBe(2);
    expect(out.totalMatches).toBe(0);
    expect(out.violations?.length).toBe(0);
  });

  it("maps violation with missing locations and preserves resources", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfca-query-"));
    const violations = [
      {
        rule: "no.location.rule",
        engine: "pmd",
        severity: 2,
        tags: ["Security"],
        primaryLocationIndex: 0,
        // locations intentionally omitted to hit mapping fallback
        message: "Message",
        resources: ["http://example.com/rule-doc"]
      }
    ];
    const file = writeResultsJson(tmp, "results.json", makeResults(violations as any));
    const out = await action.exec({
      resultsFile: file,
      filters: { engines: [], severities: [], tags: [], rules: [], fileContains: [], fileEndsWith: [] },
      topN: 10
    });
    expect(out.status).toEqual("success");
    expect(out.totalMatches).toBe(1);
    expect(out.violations?.[0].primaryLocation.file).toBeUndefined();
    expect(out.violations?.[0].resources).toEqual(["http://example.com/rule-doc"]);
  });

  it("engine filter negative returns zero matches", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfca-query-"));
    const violations = [
      makeViolation({ engine: "eslint" })
    ];
    const file = writeResultsJson(tmp, "results.json", makeResults(violations));
    const out = await action.exec({
      resultsFile: file,
      filters: { engines: ["pmd"], severities: [], tags: [], rules: [], fileContains: [], fileEndsWith: [] },
      topN: 10
    });
    expect(out.status).toEqual("success");
    expect(out.totalMatches).toBe(0);
    expect(out.violations?.length).toBe(0);
  });

  it("sorts by severity (default) ascending", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfca-query-"));
    const violations = [
      makeViolation({ severity: 5, rule: "sev5" }),
      makeViolation({ severity: 2, rule: "sev2" }),
      makeViolation({ severity: 4, rule: "sev4" })
    ];
    const file = writeResultsJson(tmp, "results.json", makeResults(violations));
    const out = await action.exec({
      resultsFile: file,
      filters: { engines: [], severities: [], tags: [], rules: [], fileContains: [], fileEndsWith: [] },
      topN: 10
    });
    expect(out.status).toEqual("success");
    // Expect sev2, sev4, sev5 by ascending severity
    expect(out.violations?.map(v => v.rule)).toEqual(["sev2", "sev4", "sev5"]);
  });

  it("maps severityName fallback when severity is outside 1-5", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfca-query-"));
    const violations = [
      makeViolation({ severity: 9, rule: "weird.severity" })
    ];
    const file = writeResultsJson(tmp, "results.json", makeResults(violations));
    const out = await action.exec({
      resultsFile: file,
      filters: { engines: [], severities: [], tags: [], rules: [], fileContains: [], fileEndsWith: [] },
      topN: 10
    });
    expect(out.status).toEqual("success");
    expect(out.violations?.[0].severity).toBe(9);
    expect(out.violations?.[0].severityName).toBe("9");
  });

  it("totalViolations falls back to allViolations.length when violationCounts is missing", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfca-query-"));
    const payload = {
      runDir: "/workspace",
      versions: { core: "0.0.0" },
      violations: [
        makeViolation({ rule: "r1" }),
        makeViolation({ rule: "r2" })
      ]
    };
    const file = writeResultsJson(tmp, "results.json", payload);
    const out = await action.exec({
      resultsFile: file,
      filters: { engines: [], severities: [], tags: [], rules: [], fileContains: [], fileEndsWith: [] },
      topN: 10
    });
    expect(out.status).toEqual("success");
    expect(out.totalViolations).toBe(2);
  });

  it("uses secondary file comparison when primary compare is equal (asc)", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfca-query-"));
    const violations = [
      makeViolation({ rule: "same.rule", file: "/z/file.ts" }),
      makeViolation({ rule: "same.rule", file: "/a/file.ts" })
    ];
    const file = writeResultsJson(tmp, "results.json", makeResults(violations));
    const out = await action.exec({
      resultsFile: file,
      filters: { engines: [], severities: [], tags: [], rules: [], fileContains: [], fileEndsWith: [] },
      sortBy: 'rule',
      sortDirection: 'asc',
      topN: 10
    });
    expect(out.status).toEqual("success");
    const files = out.violations?.map(v => v.primaryLocation.file);
    expect(files?.[0]?.endsWith("/a/file.ts")).toBe(true);
    expect(files?.[1]?.endsWith("/z/file.ts")).toBe(true);
  });

  it("uses secondary file comparison (desc with mul = -1)", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfca-query-"));
    const violations = [
      makeViolation({ rule: "same.rule", file: "/a/file.ts" }),
      makeViolation({ rule: "same.rule", file: "/z/file.ts" })
    ];
    const file = writeResultsJson(tmp, "results.json", makeResults(violations));
    const out = await action.exec({
      resultsFile: file,
      filters: { engines: [], severities: [], tags: [], rules: [], fileContains: [], fileEndsWith: [] },
      sortBy: 'rule',
      sortDirection: 'desc',
      topN: 10
    });
    expect(out.status).toEqual("success");
    const files = out.violations?.map(v => v.primaryLocation.file);
    expect(files?.[0]?.endsWith("/z/file.ts")).toBe(true);
    expect(files?.[1]?.endsWith("/a/file.ts")).toBe(true);
  });

  it("sorts by file when both violations have no locations, falling back to rule compare", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfca-query-"));
    const violations = [
      {
        rule: "b.rule",
        engine: "pmd",
        severity: 2,
        tags: ["Security"],
        primaryLocationIndex: 0,
        message: "Message",
        resources: []
      },
      {
        rule: "a.rule",
        engine: "pmd",
        severity: 2,
        tags: ["Security"],
        primaryLocationIndex: 0,
        message: "Message",
        resources: []
      }
    ];
    const file = writeResultsJson(tmp, "results.json", makeResults(violations as any));
    const out = await action.exec({
      resultsFile: file,
      filters: { engines: [], severities: [], tags: [], rules: [], fileContains: [], fileEndsWith: [] },
      sortBy: 'file',
      topN: 10
    });
    expect(out.status).toEqual("success");
    // With both empty files, fallback is rule compare ascending
    expect(out.violations?.map(v => v.rule)).toEqual(["a.rule", "b.rule"]);
  });
  it("sorts by file even when some violations have no locations", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfca-query-"));
    const violations = [
      {
        rule: "no.location.rule",
        engine: "pmd",
        severity: 2,
        tags: ["Security"],
        primaryLocationIndex: 0,
        // locations intentionally omitted
        message: "Message",
        resources: []
      },
      makeViolation({ file: "/a/file.ts", rule: "with.location" })
    ];
    const file = writeResultsJson(tmp, "results.json", makeResults(violations as any));
    const out = await action.exec({
      resultsFile: file,
      filters: { engines: [], severities: [], tags: [], rules: [], fileContains: [], fileEndsWith: [] },
      sortBy: 'file',
      topN: 10
    });
    expect(out.status).toEqual("success");
    // '' (missing file) should sort before '/a/file.ts'
    const files = out.violations?.map(v => v.primaryLocation.file ?? "");
    expect(files?.[0]).toBe("");
    expect(files?.[1]?.endsWith("/a/file.ts")).toBe(true);
  });
  it("respects sortBy='none' (returns original order)", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfca-query-"));
    const violations = [
      makeViolation({ rule: "first.rule", severity: 5 }),
      makeViolation({ rule: "second.rule", severity: 1 })
    ];
    const file = writeResultsJson(tmp, "results.json", makeResults(violations));
    const out = await action.exec({
      resultsFile: file,
      filters: { engines: [], severities: [], tags: [], rules: [], fileContains: [], fileEndsWith: [] },
      sortBy: 'none',
      topN: 10
    });
    expect(out.status).toEqual("success");
    expect(out.totalMatches).toBe(2);
    expect(out.violations?.map(v => v.rule)).toEqual(["first.rule", "second.rule"]);
  });

  it("sorts by rule name ascending", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfca-query-"));
    const violations = [
      makeViolation({ rule: "b.rule" }),
      makeViolation({ rule: "a.rule" })
    ];
    const file = writeResultsJson(tmp, "results.json", makeResults(violations));
    const out = await action.exec({
      resultsFile: file,
      filters: { engines: [], severities: [], tags: [], rules: [], fileContains: [], fileEndsWith: [] },
      sortBy: 'rule',
      topN: 10
    });
    expect(out.status).toEqual("success");
    expect(out.violations?.map(v => v.rule)).toEqual(["a.rule", "b.rule"]);
  });

  it("sorts by engine name ascending", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfca-query-"));
    const violations = [
      makeViolation({ engine: "pmd" }),
      makeViolation({ engine: "eslint" })
    ];
    const file = writeResultsJson(tmp, "results.json", makeResults(violations));
    const out = await action.exec({
      resultsFile: file,
      filters: { engines: [], severities: [], tags: [], rules: [], fileContains: [], fileEndsWith: [] },
      sortBy: 'engine',
      topN: 10
    });
    expect(out.status).toEqual("success");
    expect(out.violations?.map(v => v.engine)).toEqual(["eslint", "pmd"]);
  });

  it("sorts by file path ascending", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfca-query-"));
    const violations = [
      makeViolation({ file: "/z/file.ts" }),
      makeViolation({ file: "/a/file.ts" })
    ];
    const file = writeResultsJson(tmp, "results.json", makeResults(violations));
    const out = await action.exec({
      resultsFile: file,
      filters: { engines: [], severities: [], tags: [], rules: [], fileContains: [], fileEndsWith: [] },
      sortBy: 'file',
      topN: 10
    });
    expect(out.status).toEqual("success");
    const files = out.violations?.map(v => v.primaryLocation.file);
    expect(files?.[0]?.endsWith("/a/file.ts")).toBe(true);
    expect(files?.[1]?.endsWith("/z/file.ts")).toBe(true);
  });
});


