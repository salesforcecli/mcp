/**
 * Severity levels for detected antipatterns
 */
export enum Severity {
  /**
   * Low severity - minor performance impact
   */
  LOW = "low",

  /**
   * Medium severity - noticeable performance impact
   */
  MEDIUM = "medium",

  /**
   * High severity - significant performance impact
   */
  HIGH = "high",

  /**
   * Critical severity - severe performance or functional impact
   */
  CRITICAL = "critical",
}
