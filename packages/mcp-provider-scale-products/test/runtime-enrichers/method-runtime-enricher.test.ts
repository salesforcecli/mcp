import { describe, it, expect } from "vitest";
import { MethodRuntimeEnricher } from "../../src/runtime-enrichers/method-runtime-enricher.js";
import { AntipatternType } from "../../src/models/antipattern-type.js";
import { Severity } from "../../src/models/severity.js";
import type { DetectedAntipattern } from "../../src/models/detection-result.js";
import type { ClassRuntimeData, MethodRuntimeData, EntrypointData } from "../../src/models/runtime-data.js";

function makeDetection(overrides: Partial<DetectedAntipattern> = {}): DetectedAntipattern {
  return {
    className: "TestClass",
    methodName: "testMethod",
    lineNumber: 10,
    codeBefore: "Schema.getGlobalDescribe()",
    severity: Severity.MAJOR,
    severitySource: "static",
    ...overrides,
  };
}

function makeEntrypoint(avgCpuTime: number): EntrypointData {
  return {
    entrypointName: "Trigger",
    avgCpuTime,
    avgDbTime: 100,
    sumCpuTime: avgCpuTime * 2,
    sumDbTime: 200,
  };
}

describe("MethodRuntimeEnricher", () => {
  it("should return GGD as antipattern types", () => {
    const enricher = new MethodRuntimeEnricher();
    expect(enricher.getAntipatternTypes()).toEqual([AntipatternType.GGD]);
  });

  it("should return detections unchanged when no methods in runtime data", () => {
    const enricher = new MethodRuntimeEnricher();
    const runtimeData: ClassRuntimeData = { methods: [], soqlRuntimeData: [] };
    const detections = [makeDetection()];
    const result = enricher.enrich(detections, runtimeData, "TestClass");
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe(Severity.MAJOR);
    expect(result[0].severitySource).toBe("static");
  });

  it("should return detections unchanged when methods array is undefined", () => {
    const enricher = new MethodRuntimeEnricher();
    const runtimeData = { methods: undefined, soqlRuntimeData: [] } as unknown as ClassRuntimeData;
    const detections = [makeDetection()];
    const result = enricher.enrich(detections, runtimeData, "TestClass");
    expect(result[0].severitySource).toBe("static");
  });

  it("should return detection unchanged when no methodName", () => {
    const enricher = new MethodRuntimeEnricher();
    const methodData: MethodRuntimeData = {
      methodName: "testMethod",
      entrypoints: [makeEntrypoint(100)],
    };
    const runtimeData: ClassRuntimeData = {
      methods: [methodData],
      soqlRuntimeData: [],
    };
    const detections = [makeDetection({ methodName: undefined })];
    const result = enricher.enrich(detections, runtimeData, "TestClass");
    expect(result[0].severitySource).toBe("static");
  });

  it("should enrich detection when method matches (MAJOR from runtime)", () => {
    const enricher = new MethodRuntimeEnricher();
    const methodData: MethodRuntimeData = {
      methodName: "testMethod",
      entrypoints: [makeEntrypoint(500)],
    };
    const runtimeData: ClassRuntimeData = {
      methods: [methodData],
      soqlRuntimeData: [],
    };
    const detections = [makeDetection()];
    const result = enricher.enrich(detections, runtimeData, "TestClass");
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe(Severity.MAJOR);
    expect(result[0].severitySource).toBe("runtime");
    expect(result[0].entrypoints_impacted_by_method).toContain("Trigger");
  });

  it("should enrich detection with CRITICAL when avgCpuTime above threshold", () => {
    const enricher = new MethodRuntimeEnricher();
    const methodData: MethodRuntimeData = {
      methodName: "testMethod",
      entrypoints: [makeEntrypoint(3000)],
    };
    const runtimeData: ClassRuntimeData = {
      methods: [methodData],
      soqlRuntimeData: [],
    };
    const detections = [makeDetection()];
    const result = enricher.enrich(detections, runtimeData, "TestClass");
    expect(result[0].severity).toBe(Severity.CRITICAL);
    expect(result[0].severitySource).toBe("runtime");
  });

  it("should match method name case-insensitively", () => {
    const enricher = new MethodRuntimeEnricher();
    const methodData: MethodRuntimeData = {
      methodName: "TestMethod",
      entrypoints: [makeEntrypoint(100)],
    };
    const runtimeData: ClassRuntimeData = {
      methods: [methodData],
      soqlRuntimeData: [],
    };
    const detections = [makeDetection({ methodName: "testmethod" })];
    const result = enricher.enrich(detections, runtimeData, "TestClass");
    expect(result[0].severitySource).toBe("runtime");
  });

  it("should keep detection when no matching method in runtime data", () => {
    const enricher = new MethodRuntimeEnricher();
    const methodData: MethodRuntimeData = {
      methodName: "otherMethod",
      entrypoints: [makeEntrypoint(100)],
    };
    const runtimeData: ClassRuntimeData = {
      methods: [methodData],
      soqlRuntimeData: [],
    };
    const detections = [makeDetection()];
    const result = enricher.enrich(detections, runtimeData, "TestClass");
    expect(result[0].severitySource).toBe("static");
  });
});
