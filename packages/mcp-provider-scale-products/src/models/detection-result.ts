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
   * The code after fix - contains the optimized/corrected code (optional)
   * Used for antipatterns that provide actual fix generation (e.g., SOQL unused fields)
   */
  codeAfter?: string;

  /**
   * Severity/priority of this detection
   */
  severity: Severity;

  /**
   * Entrypoints affected by this issue (optional)
   */
  entrypoints?: string;

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
   * List of all fields in the original SOQL query
   */
  originalFields: string[];

  /**
   * Variable name that the SOQL result is assigned to (if any)
   */
  assignedVariable: string | null;

  /**
   * Whether the SOQL is inside a loop
   */
  isInLoop: boolean;

  /**
   * Whether the SOQL result variable is returned from the method
   */
  isReturned: boolean;

  /**
   * Whether the SOQL result is assigned to a class member field
   */
  isClassMember: boolean;

  /**
   * Whether the SOQL query contains nested subqueries
   */
  hasNestedQueries: boolean;

  /**
   * Fields that are used in subsequent SOQL queries
   */
  usedInLaterSOQLs: string[];

  /**
   * Whether the complete SOQL result object is used (not individual fields)
   */
  completeUsageDetected: boolean;
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
