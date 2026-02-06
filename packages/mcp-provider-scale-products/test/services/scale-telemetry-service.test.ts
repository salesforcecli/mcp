import { describe, it, expect, beforeEach } from "vitest";
import { ScaleTelemetryService } from "../../src/services/scale-telemetry-service.js";
import { SpyTelemetryService } from "../test-doubles.js";
import { RuntimeDataStatus } from "../../src/services/runtime-data-service.js";
import { AntipatternType } from "../../src/models/antipattern-type.js";
import type { ScanResult, AntipatternResult, DetectedAntipattern } from "../../src/models/detection-result.js";
import { Severity } from "../../src/models/severity.js";

describe("ScaleTelemetryService", () => {
  let spyTelemetry: SpyTelemetryService;
  let service: ScaleTelemetryService;

  beforeEach(() => {
    spyTelemetry = new SpyTelemetryService();
    service = new ScaleTelemetryService(spyTelemetry);
  });

  it("should emit tool invocation with org info", () => {
    service.emitToolInvocation("scan_apex", { orgId: "org1", userId: "user1" }, { className: "MyClass" });
    expect(spyTelemetry.sendEventCallHistory).toHaveLength(1);
    expect(spyTelemetry.sendEventCallHistory[0].eventName).toBe("scale_mcp_tool_invocation");
    expect(spyTelemetry.sendEventCallHistory[0].event.toolName).toBe("scan_apex");
    expect(spyTelemetry.sendEventCallHistory[0].event.orgId).toBe("org1");
    expect(spyTelemetry.sendEventCallHistory[0].event.userId).toBe("user1");
    expect(spyTelemetry.sendEventCallHistory[0].event.className).toBe("MyClass");
  });

  it("should emit tool invocation with null org info", () => {
    service.emitToolInvocation("scan_apex", null);
    expect(spyTelemetry.sendEventCallHistory[0].event.orgId).toBeNull();
    expect(spyTelemetry.sendEventCallHistory[0].event.userId).toBeNull();
  });

  it("should emit scan results with antipattern breakdown", () => {
    const scanResult: ScanResult = {
      antipatternResults: [
        {
          antipatternType: AntipatternType.GGD,
          fixInstruction: "Fix GGD",
          detectedInstances: [
            { className: "C", lineNumber: 1, codeBefore: "x", severity: Severity.CRITICAL, severitySource: "runtime" },
            { className: "C", lineNumber: 2, codeBefore: "y", severity: Severity.MAJOR, severitySource: "static" },
          ],
        },
      ],
    };
    service.emitScanResults("scan_apex", { orgId: "o", userId: "u" }, scanResult, "MyClass", RuntimeDataStatus.SUCCESS, "req-1");
    expect(spyTelemetry.sendEventCallHistory).toHaveLength(1);
    expect(spyTelemetry.sendEventCallHistory[0].eventName).toBe("scale_mcp_scan_results");
    expect(spyTelemetry.sendEventCallHistory[0].event.totalAntipatterns).toBe(2);
    expect(spyTelemetry.sendEventCallHistory[0].event.runtimeBasedCount).toBe(1);
    expect(spyTelemetry.sendEventCallHistory[0].event.staticBasedCount).toBe(1);
    expect(spyTelemetry.sendEventCallHistory[0].event.requestId).toBe("req-1");
    const breakdown = JSON.parse(spyTelemetry.sendEventCallHistory[0].event.antipatternTypeBreakdown as string);
    expect(breakdown.GGD).toEqual({ runtime: 1, static: 1 });
  });

  it("should emit scan results without requestId when not provided", () => {
    const scanResult: ScanResult = { antipatternResults: [] };
    service.emitScanResults("scan_apex", null, scanResult, "MyClass", RuntimeDataStatus.NO_ORG_CONNECTION);
    expect(spyTelemetry.sendEventCallHistory[0].event.requestId).toBeUndefined();
  });

  it("should emit runtime fetch error with optional params", () => {
    service.emitRuntimeFetchError(
      "scan_apex",
      { orgId: "o", userId: "u" },
      "MyClass",
      "API_ERROR",
      "Network error",
      "req-1",
      2
    );
    expect(spyTelemetry.sendEventCallHistory[0].eventName).toBe("scale_mcp_runtime_fetch_error");
    expect(spyTelemetry.sendEventCallHistory[0].event.errorType).toBe("API_ERROR");
    expect(spyTelemetry.sendEventCallHistory[0].event.requestId).toBe("req-1");
    expect(spyTelemetry.sendEventCallHistory[0].event.retryAttempts).toBe(2);
  });

  it("should emit runtime fetch error without optional params", () => {
    service.emitRuntimeFetchError("scan_apex", null, "MyClass", "ACCESS_DENIED", "Access denied");
    expect(spyTelemetry.sendEventCallHistory[0].event.requestId).toBeUndefined();
    expect(spyTelemetry.sendEventCallHistory[0].event.retryAttempts).toBeUndefined();
  });

  it("should emit execution error", () => {
    service.emitExecutionError("scan_apex", { orgId: "o", userId: "u" }, "MyClass", "Parse error");
    expect(spyTelemetry.sendEventCallHistory[0].eventName).toBe("scale_mcp_scan_apex_antipatterns_error");
    expect(spyTelemetry.sendEventCallHistory[0].event.errorType).toBe("EXECUTION_ERROR");
    expect(spyTelemetry.sendEventCallHistory[0].event.error).toBe("Parse error");
  });
});
