import { AntipatternType } from "./antipattern-type.js";
import { Severity } from "./severity.js";

/**
 * Source of severity calculation
 */
export type SeveritySource = "static" | "runtime";

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
   * The code after fix - contains the optimized/corrected code (optional)
   * Used for antipatterns that provide actual fix generation (e.g., SOQL unused fields)
   */
  codeAfter?: string;

  /**
   * Severity/priority of this detection
   */
  severity: Severity;

  /**
   * Source of severity calculation:
   * - "static": Based on static code analysis only
   * - "runtime": Based on actual runtime metrics from the org (marked with 💡 in reports)
   */
  severitySource: SeveritySource;

  /**
   * Entrypoints impacted by this method (optional)
   * Shows top entrypoints that call this method, with aggregated metrics
   */
  entrypoints_impacted_by_method?: string;

  /**
   * Additional metadata specific to the antipattern type (optional)
   * Used to provide context-specific information for fix generation
   */
  metadata?: AntipatternMetadata;
}

/**
 * Metadata for SOQL unused fields antipattern
 */
export interface SOQLUnusedFieldsMetadata {
  /**
   * List of fields that are selected but never used
   */
  unusedFields: string[];

  /**
   * Variable name that the SOQL result is assigned to (if any)
   */
  assignedVariable: string | null;
}

/**
 * Union type for all antipattern-specific metadata
 */
export type AntipatternMetadata = SOQLUnusedFieldsMetadata | Record<string, any>;

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
