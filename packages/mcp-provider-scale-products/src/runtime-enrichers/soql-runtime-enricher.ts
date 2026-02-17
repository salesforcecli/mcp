/**
 * SOQL Runtime Enricher
 * 
 * Enriches SOQL-based antipattern detections with runtime data.
 * Maps runtime data to detections using line numbers from uniqueQueryIdentifier.
 * 
 * Handles antipattern types:
 * - SOQL_NO_WHERE_LIMIT
 * - SOQL_UNUSED_FIELDS
 */

import { BaseRuntimeEnricher } from "./base-runtime-enricher.js";
import { DetectedAntipattern } from "../models/detection-result.js";
import { AntipatternType } from "../models/antipattern-type.js";
import { ClassRuntimeData, SOQLRuntimeData } from "../models/runtime-data.js";
import {
  calculateSOQLSeverity,
  parseLineNumberFromIdentifier,
  SOQLSeverityThresholds,
  DEFAULT_SOQL_THRESHOLDS,
} from "./severity-calculator.js";

/**
 * Runtime enricher for SOQL-based antipatterns
 * Maps runtime data to detections via line number matching
 */
export class SOQLRuntimeEnricher implements BaseRuntimeEnricher {
  private readonly thresholds: SOQLSeverityThresholds;

  constructor(thresholds?: SOQLSeverityThresholds) {
    this.thresholds = thresholds ?? DEFAULT_SOQL_THRESHOLDS;
  }

  /**
   * Returns the antipattern types this enricher handles
   */
  public getAntipatternTypes(): AntipatternType[] {
    return [
      AntipatternType.SOQL_NO_WHERE_LIMIT,
      AntipatternType.SOQL_UNUSED_FIELDS,
    ];
  }

  /**
   * Enriches SOQL antipattern detections with runtime data
   * 
   * Mapping strategy:
   * 1. Parse line number from uniqueQueryIdentifier (format: "ClassName.cls.LINE")
   * 2. Match with detection.lineNumber
   * 3. Calculate severity from runtime metrics
   * 
   * @param detections - Array of detected SOQL antipatterns
   * @param classRuntimeData - Runtime data for the class
   * @param className - Name of the Apex class
   * @returns Enriched detections with updated severity
   */
  public enrich(
    detections: DetectedAntipattern[],
    classRuntimeData: ClassRuntimeData,
    className: string
  ): DetectedAntipattern[] {
    if (!classRuntimeData.soqlRuntimeData || classRuntimeData.soqlRuntimeData.length === 0) {
      return detections;
    }

    // Build a map of line number -> SOQL runtime data for efficient lookup
    const runtimeByLine = this.buildLineNumberMap(classRuntimeData.soqlRuntimeData, className);

    // Enrich each detection
    const enrichedDetections = detections.map((detection) => {
      const runtimeData = runtimeByLine.get(detection.lineNumber);

      if (runtimeData) {
        // Found matching runtime data - calculate new severity
        const newSeverity = calculateSOQLSeverity(runtimeData, this.thresholds);

        return {
          ...detection,
          severity: newSeverity,
          severitySource: "runtime" as const, // Mark as runtime-derived (💡 in reports)
          // Add runtime metrics info for display
          entrypoints_impacted_by_method: this.formatRuntimeMetrics(runtimeData),
        };
      }

      // No matching runtime data - keep original detection
      return detection;
    });

    return enrichedDetections;
  }

  /**
   * Builds a map of line numbers to SOQL runtime data
   * Filters for entries matching the current class
   * 
   * @param soqlRuntimeData - Array of SOQL runtime data from Connect endpoint
   * @param className - Class name to filter for
   * @returns Map of line number to runtime data
   */
  private buildLineNumberMap(
    soqlRuntimeData: SOQLRuntimeData[],
    className: string
  ): Map<number, SOQLRuntimeData> {
    const map = new Map<number, SOQLRuntimeData>();

    for (const data of soqlRuntimeData) {
      // Check if this identifier belongs to the target class
      // Format: "ClassName.cls.79"
      if (data.uniqueQueryIdentifier.startsWith(`${className}.cls.`)) {
        const lineNumber = parseLineNumberFromIdentifier(data.uniqueQueryIdentifier);
        if (lineNumber !== null) {
          map.set(lineNumber, data);
        }
      }
    }

    return map;
  }

  /**
   * Formats runtime metrics information for display
   * 
   * @param runtimeData - SOQL runtime data
   * @returns Formatted string with runtime metrics
   */
  private formatRuntimeMetrics(runtimeData: SOQLRuntimeData): string {
    return `Query executed ${runtimeData.representativeCount} times, total execution time: ${runtimeData.totalQueryExecutionTime}ms`;
  }
}

