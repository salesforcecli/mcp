/**
 * Severity levels for detected antipatterns
 */
export enum Severity {
  /**
   * Minor severity - low performance impact
   */
  MINOR = "minor",

  /**
   * Major severity - noticeable performance impact
   */
  MAJOR = "major",

  /**
   * Critical severity - severe performance or functional impact
   */
  CRITICAL = "critical",
}
