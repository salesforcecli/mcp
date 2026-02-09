import { describe, it, expect } from "vitest";
import { SOQLRuntimeEnricher } from "../../src/runtime-enrichers/soql-runtime-enricher.js";
import { AntipatternType } from "../../src/models/antipattern-type.js";
import { Severity } from "../../src/models/severity.js";
import type { DetectedAntipattern } from "../../src/models/detection-result.js";
import type { ClassRuntimeData, SOQLRuntimeData } from "../../src/models/runtime-data.js";

function makeDetection(lineNumber: number, overrides: Partial<DetectedAntipattern> = {}): DetectedAntipattern {
  return {
    className: "TestClass",
    lineNumber,
    codeBefore: "SELECT Id FROM Account",
    severity: Severity.MAJOR,
    severitySource: "static",
    ...overrides,
  };
}

describe("SOQLRuntimeEnricher", () => {
  it("should return SOQL antipattern types", () => {
    const enricher = new SOQLRuntimeEnricher();
    expect(enricher.getAntipatternTypes()).toContain(AntipatternType.SOQL_NO_WHERE_LIMIT);
    expect(enricher.getAntipatternTypes()).toContain(AntipatternType.SOQL_UNUSED_FIELDS);
  });

  it("should return detections unchanged when no soqlRuntimeData", () => {
    const enricher = new SOQLRuntimeEnricher();
    const runtimeData: ClassRuntimeData = { methods: [], soqlRuntimeData: [] };
    const detections = [makeDetection(10)];
    const result = enricher.enrich(detections, runtimeData, "TestClass");
    expect(result[0].severitySource).toBe("static");
  });

  it("should return detections unchanged when soqlRuntimeData is undefined", () => {
    const enricher = new SOQLRuntimeEnricher();
    const runtimeData = { methods: [], soqlRuntimeData: undefined } as unknown as ClassRuntimeData;
    const detections = [makeDetection(10)];
    const result = enricher.enrich(detections, runtimeData, "TestClass");
    expect(result[0].severitySource).toBe("static");
  });

  it("should enrich detection when line number matches", () => {
    const enricher = new SOQLRuntimeEnricher();
    const soqlData: SOQLRuntimeData = {
      uniqueQueryIdentifier: "TestClass.cls.10",
      representativeCount: 5000,
      totalQueryExecutionTime: 100,
    };
    const runtimeData: ClassRuntimeData = {
      methods: [],
      soqlRuntimeData: [soqlData],
    };
    const detections = [makeDetection(10)];
    const result = enricher.enrich(detections, runtimeData, "TestClass");
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe(Severity.MAJOR);
    expect(result[0].severitySource).toBe("runtime");
    expect(result[0].entrypoints_impacted_by_method).toContain("5000 times");
  });

  it("should only match same class identifier", () => {
    const enricher = new SOQLRuntimeEnricher();
    const soqlData: SOQLRuntimeData = {
      uniqueQueryIdentifier: "OtherClass.cls.10",
      representativeCount: 5000,
      totalQueryExecutionTime: 100,
    };
    const runtimeData: ClassRuntimeData = {
      methods: [],
      soqlRuntimeData: [soqlData],
    };
    const detections = [makeDetection(10)];
    const result = enricher.enrich(detections, runtimeData, "TestClass");
    expect(result[0].severitySource).toBe("static");
  });

  it("should keep detection when line number does not match", () => {
    const enricher = new SOQLRuntimeEnricher();
    const soqlData: SOQLRuntimeData = {
      uniqueQueryIdentifier: "TestClass.cls.20",
      representativeCount: 5000,
      totalQueryExecutionTime: 100,
    };
    const runtimeData: ClassRuntimeData = {
      methods: [],
      soqlRuntimeData: [soqlData],
    };
    const detections = [makeDetection(10)];
    const result = enricher.enrich(detections, runtimeData, "TestClass");
    expect(result[0].severitySource).toBe("static");
  });
});
