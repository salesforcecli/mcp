import { DetectedAntipattern } from "../models/detection-result.js";
import { AntipatternType } from "../models/antipattern-type.js";

/**
 * Base interface for all antipattern detectors
 * Follows Single Responsibility Principle - only responsible for detection
 */
export interface BaseDetector {
  /**
   * Returns the type of antipattern this detector handles
   */
  getAntipatternType(): AntipatternType;

  /**
   * Detects antipatterns in the provided Apex class content
   * Note: fixInstruction field will be empty - filled by recommender
   * @param className - Name of the Apex class being analyzed
   * @param apexCode - The full Apex class source code
   * @returns Array of detected antipatterns (without fix instructions yet)
   */
  detect(className: string, apexCode: string): DetectedAntipattern[];
}
