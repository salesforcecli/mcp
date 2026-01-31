/**
 * Scale Telemetry Service
 * 
 * Wrapper around base TelemetryService with helper methods for common telemetry patterns
 * in the Scale Products MCP provider tools.
 */

import { TelemetryService, TelemetryEvent } from "@salesforce/mcp-provider-api";
import { ScanResult, AntipatternResult } from "../models/detection-result.js";
import { AntipatternType } from "../models/antipattern-type.js";
import { RuntimeDataStatus } from "./runtime-data-service.js";

/**
 * Org information for telemetry events
 */
export interface OrgInfo {
  orgId: string;
  userId: string;
}

/**
 * Wrapper service for emitting telemetry events with consistent structure
 */
export class ScaleTelemetryService {
  private readonly telemetryService: TelemetryService;

  public constructor(telemetryService: TelemetryService) {
    this.telemetryService = telemetryService;
  }

  /**
   * Emits a tool invocation event with org/user identification
   * 
   * @param toolName - Name of the tool being invoked
   * @param orgInfo - Org information (null if no org connection)
   * @param additionalAttributes - Additional attributes to include in the event
   */
  public emitToolInvocation(
    toolName: string,
    orgInfo: OrgInfo | null,
    additionalAttributes?: TelemetryEvent
  ): void {
    this.telemetryService.sendEvent("scale_mcp_tool_invocation", {
      toolName,
      orgId: orgInfo?.orgId ?? null,
      userId: orgInfo?.userId ?? null,
      ...additionalAttributes,
    });
  }

  /**
   * Emits detailed scan results with antipattern breakdowns
   * 
   * @param toolName - Name of the tool that performed the scan
   * @param orgInfo - Org information (null if no org connection)
   * @param scanResult - The scan result containing all antipattern detections
   * @param className - Name of the class that was scanned
   * @param runtimeDataStatus - Status of runtime data fetch
   * @param requestId - Request ID used for runtime fetch (optional)
   */
  public emitScanResults(
    toolName: string,
    orgInfo: OrgInfo | null,
    scanResult: ScanResult,
    className: string,
    runtimeDataStatus: RuntimeDataStatus,
    requestId?: string
  ): void {
    const antipatternResults = scanResult.antipatternResults;

    // Calculate total antipatterns
    const totalAntipatterns = antipatternResults.reduce(
      (sum, result) => sum + result.detectedInstances.length,
      0
    );

    // Extract antipattern types
    const antipatternTypes = antipatternResults.map((r) => r.antipatternType);

    // Calculate per-type counts
    const antipatternTypeCounts: Record<string, number> = {};
    for (const result of antipatternResults) {
      antipatternTypeCounts[result.antipatternType] = result.detectedInstances.length;
    }

    // Calculate aggregate runtime vs static counts
    let runtimeBasedCount = 0;
    let staticBasedCount = 0;

    // Calculate per-type breakdown
    const antipatternTypeBreakdown: Record<string, { runtime: number; static: number }> = {};

    for (const result of antipatternResults) {
      let runtimeCount = 0;
      let staticCount = 0;

      for (const instance of result.detectedInstances) {
        if (instance.severitySource === "runtime") {
          runtimeCount++;
          runtimeBasedCount++;
        } else {
          staticCount++;
          staticBasedCount++;
        }
      }

      antipatternTypeBreakdown[result.antipatternType] = {
        runtime: runtimeCount,
        static: staticCount,
      };
    }

    this.telemetryService.sendEvent("scale_mcp_scan_results", {
      toolName,
      orgId: orgInfo?.orgId ?? null,
      userId: orgInfo?.userId ?? null,
      className,
      totalAntipatterns,
      antipatternTypes: antipatternTypes.join(","),
      antipatternTypeCounts: JSON.stringify(antipatternTypeCounts),
      runtimeBasedCount,
      staticBasedCount,
      antipatternTypeBreakdown: JSON.stringify(antipatternTypeBreakdown),
      runtimeDataStatus,
      ...(requestId ? { requestId } : {}),
    });
  }

  /**
   * Emits a runtime fetch error event
   * 
   * @param toolName - Name of the tool that encountered the error
   * @param orgInfo - Org information (null if no org connection)
   * @param className - Name of the class being scanned
   * @param errorType - Type of error encountered
   * @param errorMessage - Error message from the service
   * @param requestId - Request ID used for runtime fetch (optional)
   * @param retryAttempts - Number of retry attempts (optional)
   */
  public emitRuntimeFetchError(
    toolName: string,
    orgInfo: OrgInfo | null,
    className: string,
    errorType: "ACCESS_DENIED" | "API_ERROR" | "NO_ORG_CONNECTION",
    errorMessage: string,
    requestId?: string,
    retryAttempts?: number
  ): void {
    this.telemetryService.sendEvent("scale_mcp_runtime_fetch_error", {
      toolName,
      orgId: orgInfo?.orgId ?? null,
      userId: orgInfo?.userId ?? null,
      className,
      errorType,
      errorMessage,
      ...(requestId ? { requestId } : {}),
      ...(retryAttempts !== undefined ? { retryAttempts } : {}),
    });
  }

  /**
   * Emits a general execution error event
   * 
   * @param toolName - Name of the tool that encountered the error
   * @param orgInfo - Org information (null if no org connection)
   * @param className - Name of the class being scanned
   * @param errorMessage - Error message
   */
  public emitExecutionError(
    toolName: string,
    orgInfo: OrgInfo | null,
    className: string,
    errorMessage: string
  ): void {
    this.telemetryService.sendEvent("scale_mcp_scan_apex_antipatterns_error", {
      toolName,
      orgId: orgInfo?.orgId ?? null,
      userId: orgInfo?.userId ?? null,
      className,
      errorType: "EXECUTION_ERROR",
      error: errorMessage,
    });
  }
}
