/**
 * Severity Calculator
 * 
 * Utilities for calculating severity levels based on runtime metrics.
 * Provides configurable thresholds for different antipattern types.
 * 
 * Thresholding Logic (per ApexGuru parity):
 * 
 * 1. COCOD-Based (SOQL patterns):
 *    - COCOD ≤ 1,000 → MINOR
 *    - COCOD > 1,000 and ≤ 10,000,000 → MAJOR
 *    - COCOD > 10,000,000 → CRITICAL
 * 
 * 2. CPU Time-Based (GGD, etc.):
 *    - No entrypoint mapping → MINOR
 *    - Has entrypoint mapping → MAJOR
 *    - Any entrypoint's avg CPU time > 2,000 ms → CRITICAL
 */

import { Severity } from "../models/severity.js";
import { EntrypointData, SOQLRuntimeData } from "../models/runtime-data.js";

/**
 * Thresholds for SOQL severity calculation
 * Based on COCOD (Code Occurrence Count Data) = representativeCount
 * Uses MINOR/MAJOR/CRITICAL levels per ApexGuru parity requirements
 */
export interface SOQLSeverityThresholds {
  /**
   * COCOD count threshold for CRITICAL severity
   * COCOD > this value → CRITICAL
   */
  criticalCocodCount: number;

  /**
   * COCOD count threshold for MAJOR severity
   * COCOD > this value (and ≤ criticalCocodCount) → MAJOR
   */
  majorCocodCount: number;
}

/**
 * Thresholds for method-based severity calculation (CPU Time-Based)
 * Based on avg CPU time from entrypoints per ApexGuru parity requirements
 * Uses MINOR/MAJOR/CRITICAL levels
 */
export interface MethodSeverityThresholds {
  /**
   * Avg CPU time threshold for CRITICAL severity (ms)
   * Any entrypoint with avgCpuTime > this value → CRITICAL
   */
  criticalAvgCpuTime: number;
}

/**
 * Default thresholds for SOQL severity calculation (COCOD-based)
 * Per ApexGuru parity: 1,000 minor cutoff, 10,000,000 critical cutoff
 */
export const DEFAULT_SOQL_THRESHOLDS: SOQLSeverityThresholds = {
  criticalCocodCount: 10000000,  // COCOD > 10,000,000 → CRITICAL
  majorCocodCount: 1000,         // COCOD > 1,000 → MAJOR
};

/**
 * Default thresholds for method severity calculation (CPU Time-based)
 * Per ApexGuru parity: avgCpuTime > 2,000 ms → CRITICAL
 */
export const DEFAULT_METHOD_THRESHOLDS: MethodSeverityThresholds = {
  criticalAvgCpuTime: 2000,  // 2,000 ms avg CPU time
};

/**
 * Calculates severity for SOQL antipatterns based on COCOD (Code Occurrence Count Data)
 * Uses MINOR/MAJOR/CRITICAL levels per ApexGuru parity requirements
 * 
 * COCOD Thresholding Logic:
 * - COCOD ≤ 1,000 → MINOR
 * - COCOD > 1,000 and ≤ 10,000,000 → MAJOR
 * - COCOD > 10,000,000 → CRITICAL
 * 
 * @param runtimeData - SOQL runtime data from Connect endpoint
 * @param thresholds - Custom thresholds (optional, uses defaults if not provided)
 * @returns Calculated severity level
 */
export function calculateSOQLSeverity(
  runtimeData: SOQLRuntimeData,
  thresholds: SOQLSeverityThresholds = DEFAULT_SOQL_THRESHOLDS
): Severity {
  const { representativeCount } = runtimeData;

  // COCOD-based severity calculation per ApexGuru parity
  if (representativeCount > thresholds.criticalCocodCount) {
    return Severity.CRITICAL;
  } else if (representativeCount > thresholds.majorCocodCount) {
    return Severity.MAJOR;
  } else {
    return Severity.MINOR;
  }
}

/**
 * Calculates severity for method-based antipatterns (CPU Time-Based)
 * Per ApexGuru parity requirements
 * 
 * CPU Time-Based Thresholding Logic:
 * - No entrypoint mapping found → MINOR
 * - Has entrypoint mapping → MAJOR
 * - Any entrypoint's avg CPU time > 2,000 ms → CRITICAL
 * 
 * @param entrypoints - Array of entrypoint data for the method
 * @param thresholds - Custom thresholds (optional, uses defaults if not provided)
 * @returns Calculated severity level
 */
export function calculateMethodSeverity(
  entrypoints: EntrypointData[],
  thresholds: MethodSeverityThresholds = DEFAULT_METHOD_THRESHOLDS
): Severity {
  // No entrypoint mapping found → MINOR
  if (entrypoints.length === 0) {
    return Severity.MINOR;
  }

  // Check if any entrypoint has avg CPU time > threshold → CRITICAL
  const hasHighCpuEntrypoint = entrypoints.some(
    (ep) => ep.avgCpuTime > thresholds.criticalAvgCpuTime
  );

  if (hasHighCpuEntrypoint) {
    return Severity.CRITICAL;
  }

  // Has entrypoint mapping but no high CPU → MAJOR
  return Severity.MAJOR;
}

/**
 * Parses line number from SOQL uniqueQueryIdentifier
 * Format: "ClassName.cls.LINE_NUMBER"
 * 
 * @param uniqueQueryIdentifier - The identifier string from runtime data
 * @returns Parsed line number or null if parsing fails
 */
export function parseLineNumberFromIdentifier(uniqueQueryIdentifier: string): number | null {
  // Format: "ClassName.cls.79" -> extracts 79
  const parts = uniqueQueryIdentifier.split(".");
  if (parts.length >= 3) {
    const lineNumber = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lineNumber)) {
      return lineNumber;
    }
  }
  return null;
}

