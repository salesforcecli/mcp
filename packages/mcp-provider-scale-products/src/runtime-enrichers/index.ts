/**
 * Runtime Enrichers Module
 * 
 * Exports all runtime enrichment components for antipattern severity calculation.
 */

export type { BaseRuntimeEnricher } from "./base-runtime-enricher.js";
export { RuntimeEnricherRegistry } from "./runtime-enricher-registry.js";
export { SOQLRuntimeEnricher } from "./soql-runtime-enricher.js";
export { MethodRuntimeEnricher } from "./method-runtime-enricher.js";
export {
  calculateSOQLSeverity,
  calculateMethodSeverity,
  parseLineNumberFromIdentifier,
  DEFAULT_SOQL_THRESHOLDS,
  DEFAULT_METHOD_THRESHOLDS,
} from "./severity-calculator.js";
export type {
  SOQLSeverityThresholds,
  MethodSeverityThresholds,
} from "./severity-calculator.js";
