import { describe, it, expect } from "vitest";
import {
  calculateSOQLSeverity,
  calculateMethodSeverity,
  parseLineNumberFromIdentifier,
  DEFAULT_SOQL_THRESHOLDS,
  DEFAULT_METHOD_THRESHOLDS,
} from "../../src/runtime-enrichers/severity-calculator.js";
import { Severity } from "../../src/models/severity.js";
import type { SOQLRuntimeData, EntrypointData } from "../../src/models/runtime-data.js";

describe("severity-calculator", () => {
  describe("calculateSOQLSeverity", () => {
    it("should return MINOR when representativeCount <= majorCocodCount", () => {
      const data: SOQLRuntimeData = {
        uniqueQueryIdentifier: "MyClass.cls.10",
        representativeCount: 500,
        totalQueryExecutionTime: 100,
      };
      expect(calculateSOQLSeverity(data)).toBe(Severity.MINOR);
      expect(calculateSOQLSeverity(data, DEFAULT_SOQL_THRESHOLDS)).toBe(Severity.MINOR);
    });

    it("should return MAJOR when representativeCount > majorCocodCount and <= criticalCocodCount", () => {
      const data: SOQLRuntimeData = {
        uniqueQueryIdentifier: "MyClass.cls.10",
        representativeCount: 5000,
        totalQueryExecutionTime: 200,
      };
      expect(calculateSOQLSeverity(data)).toBe(Severity.MAJOR);
    });

    it("should return CRITICAL when representativeCount > criticalCocodCount", () => {
      const data: SOQLRuntimeData = {
        uniqueQueryIdentifier: "MyClass.cls.10",
        representativeCount: 15000000,
        totalQueryExecutionTime: 300,
      };
      expect(calculateSOQLSeverity(data)).toBe(Severity.CRITICAL);
    });

    it("should use custom thresholds when provided", () => {
      const data: SOQLRuntimeData = {
        uniqueQueryIdentifier: "x",
        representativeCount: 500,
        totalQueryExecutionTime: 0,
      };
      expect(
        calculateSOQLSeverity(data, { majorCocodCount: 100, criticalCocodCount: 1000 })
      ).toBe(Severity.MAJOR);
    });
  });

  describe("calculateMethodSeverity", () => {
    it("should return MINOR when no entrypoints", () => {
      expect(calculateMethodSeverity([])).toBe(Severity.MINOR);
    });

    it("should return MAJOR when entrypoints exist but avgCpuTime below threshold", () => {
      const entrypoints: EntrypointData[] = [
        {
          entrypointName: "Trigger",
          avgCpuTime: 500,
          avgDbTime: 100,
          sumCpuTime: 1000,
          sumDbTime: 200,
        },
      ];
      expect(calculateMethodSeverity(entrypoints)).toBe(Severity.MAJOR);
    });

    it("should return CRITICAL when any entrypoint avgCpuTime above threshold", () => {
      const entrypoints: EntrypointData[] = [
        {
          entrypointName: "Trigger",
          avgCpuTime: 3000,
          avgDbTime: 100,
          sumCpuTime: 6000,
          sumDbTime: 200,
        },
      ];
      expect(calculateMethodSeverity(entrypoints)).toBe(Severity.CRITICAL);
    });

    it("should use custom thresholds when provided", () => {
      const entrypoints: EntrypointData[] = [
        { entrypointName: "T", avgCpuTime: 500, avgDbTime: 0, sumCpuTime: 500, sumDbTime: 0 },
      ];
      expect(calculateMethodSeverity(entrypoints, { criticalAvgCpuTime: 100 })).toBe(Severity.CRITICAL);
    });
  });

  describe("parseLineNumberFromIdentifier", () => {
    it("should parse line number from ClassName.cls.LINE format", () => {
      expect(parseLineNumberFromIdentifier("MyClass.cls.79")).toBe(79);
      expect(parseLineNumberFromIdentifier("Foo.Bar.cls.10")).toBe(10);
    });

    it("should return null for invalid format", () => {
      expect(parseLineNumberFromIdentifier("MyClass")).toBeNull();
      expect(parseLineNumberFromIdentifier("MyClass.cls")).toBeNull();
      expect(parseLineNumberFromIdentifier("MyClass.cls.NaN")).toBeNull();
    });
  });
});
