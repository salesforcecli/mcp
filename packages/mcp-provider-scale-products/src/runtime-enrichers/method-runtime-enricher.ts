/**
 * Method Runtime Enricher
 * 
 * Enriches method-based antipattern detections with runtime data.
 * Maps runtime data to detections using method names.
 * 
 * Handles antipattern types:
 * - GGD (Schema.getGlobalDescribe)
 */

import { BaseRuntimeEnricher } from "./base-runtime-enricher.js";
import { DetectedAntipattern } from "../models/detection-result.js";
import { AntipatternType } from "../models/antipattern-type.js";
import {
  ClassRuntimeData,
  MethodRuntimeData,
  EntrypointData,
} from "../models/runtime-data.js";
import {
  calculateMethodSeverity,
  MethodSeverityThresholds,
  DEFAULT_METHOD_THRESHOLDS,
} from "./severity-calculator.js";

/**
 * Runtime enricher for method-based antipatterns (GGD)
 * Maps runtime data to detections via method name matching
 */
export class MethodRuntimeEnricher implements BaseRuntimeEnricher {
  private readonly thresholds: MethodSeverityThresholds;

  constructor(thresholds?: MethodSeverityThresholds) {
    this.thresholds = thresholds ?? DEFAULT_METHOD_THRESHOLDS;
  }

  /**
   * Returns the antipattern types this enricher handles
   */
  public getAntipatternTypes(): AntipatternType[] {
    return [AntipatternType.GGD];
  }

  /**
   * Enriches method-based antipattern detections with runtime data
   * 
   * Mapping strategy:
   * 1. Match detection.methodName with runtimeData.methods[].methodName
   * 2. Aggregate entrypoint metrics (sumCpuTime, sumDbTime)
   * 3. Calculate severity from aggregated metrics
   * 
   * @param detections - Array of detected method-based antipatterns
   * @param classRuntimeData - Runtime data for the class
   * @param _className - Name of the Apex class (unused but part of interface)
   * @returns Enriched detections with updated severity
   */
  public enrich(
    detections: DetectedAntipattern[],
    classRuntimeData: ClassRuntimeData,
    _className: string
  ): DetectedAntipattern[] {
    if (!classRuntimeData.methods || classRuntimeData.methods.length === 0) {
      return detections;
    }

    // Build a map of method name -> method runtime data for efficient lookup
    const runtimeByMethod = this.buildMethodNameMap(classRuntimeData.methods);

    // Enrich each detection
    const enrichedDetections = detections.map((detection) => {
      if (!detection.methodName) {
        return detection;
      }

      const runtimeData = runtimeByMethod.get(detection.methodName.toLowerCase());

      if (runtimeData && runtimeData.entrypoints.length > 0) {
        // Found matching runtime data - calculate new severity
        const newSeverity = calculateMethodSeverity(runtimeData.entrypoints, this.thresholds);

        return {
          ...detection,
          severity: newSeverity,
          severitySource: "runtime" as const, // Mark as runtime-derived (💡 in reports)
          // Add entrypoint info for display
          entrypoints_impacted_by_method: this.formatEntrypointInfo(runtimeData.entrypoints),
        };
      }

      // No matching runtime data - keep original detection
      return detection;
    });

    return enrichedDetections;
  }

  /**
   * Builds a map of method names to method runtime data
   * 
   * @param methods - Array of method runtime data from Connect endpoint
   * @returns Map of method name to runtime data
   */
  private buildMethodNameMap(
    methods: MethodRuntimeData[]
  ): Map<string, MethodRuntimeData> {
    const map = new Map<string, MethodRuntimeData>();

    for (const method of methods) {
      // Use case-insensitive lookup by storing lowercase keys
      // Apex is case-insensitive for method names
      map.set(method.methodName.toLowerCase(), method);
    }

    return map;
  }

  /**
   * Formats entrypoint information for display
   * Shows top entrypoints by CPU time
   * 
   * @param entrypoints - Array of entrypoint data
   * @returns Formatted string with entrypoint metrics
   */
  private formatEntrypointInfo(entrypoints: EntrypointData[]): string {
    // Sort by sumCpuTime descending and take top 3
    const topEntrypoints = [...entrypoints]
      .sort((a, b) => b.sumCpuTime - a.sumCpuTime)
      .slice(0, 3);

    const entrypointNames = topEntrypoints
      .map((ep) => ep.entrypointName)
      .join(", ");

    const totalCpuTime = entrypoints.reduce((sum, ep) => sum + ep.sumCpuTime, 0);
    const totalDbTime = entrypoints.reduce((sum, ep) => sum + ep.sumDbTime, 0);

    return `Top entrypoints: ${entrypointNames}. Total CPU: ${(totalCpuTime / 1000).toFixed(1)}s, Total DB: ${(totalDbTime / 1000).toFixed(1)}s`;
  }
}

