import { AntipatternType } from "./antipattern-type.js";
import { Severity } from "./severity.js";

/**
 * A single detected antipattern instance
 */
export interface DetectedAntipattern {
  /**
   * Name of the Apex class where the issue was found
   */
  className: string;

  /**
   * Name of the method where the issue was found (optional)
   */
  methodName?: string;

  /**
   * Line number where the issue was detected (1-indexed for display)
   */
  lineNumber: number;

  /**
   * The code before fix - contains the antipattern
   */
  codeBefore: string;

  /**
   * Severity/priority of this detection
   */
  severity: Severity;

  /**
   * Entrypoints affected by this issue (optional)
   */
  entrypoints?: string;
}

/**
 * All detections for a specific antipattern type
 * Groups instances with a single fix instruction
 */
export interface AntipatternResult {
  /**
   * Type of antipattern detected
   */
  antipatternType: AntipatternType;

  /**
   * LLM instruction on how to fix this antipattern type
   * Applied once for all instances of this type
   */
  fixInstruction: string;

  /**
   * Array of detected instances for this antipattern type
   */
  detectedInstances: DetectedAntipattern[];
}

/**
 * Complete scan result containing all antipattern types found
 */
export interface ScanResult {
  /**
   * Array of results grouped by antipattern type
   */
  antipatternResults: AntipatternResult[];
}
