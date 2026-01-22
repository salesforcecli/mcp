/**
 * Base Runtime Enricher Interface
 * 
 * Defines the contract for runtime enrichers that map Connect endpoint
 * runtime data to detected antipatterns for severity determination.
 */

import { DetectedAntipattern } from "../models/detection-result.js";
import { AntipatternType } from "../models/antipattern-type.js";
import { ClassRuntimeData } from "../models/runtime-data.js";

/**
 * Base interface for all runtime enrichers
 * 
 * Each antipattern type implements its own enricher with custom mapping logic:
 * - SOQL antipatterns: Map via line number from uniqueQueryIdentifier
 * - Method-based antipatterns (GGD): Map via methodName field
 */
export interface BaseRuntimeEnricher {
  /**
   * Returns the antipattern type(s) this enricher handles
   */
  getAntipatternTypes(): AntipatternType[];

  /**
   * Enriches detected antipatterns with runtime data
   * Updates severity based on runtime metrics
   * 
   * @param detections - Array of detected antipatterns (with static severity)
   * @param classRuntimeData - Runtime data for the class from Connect endpoint
   * @param className - Name of the Apex class being analyzed
   * @returns Array of enriched antipatterns with updated severity
   */
  enrich(
    detections: DetectedAntipattern[],
    classRuntimeData: ClassRuntimeData,
    className: string
  ): DetectedAntipattern[];
}

