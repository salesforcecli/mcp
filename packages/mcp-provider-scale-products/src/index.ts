/**
 * This file dictates what is exported at the top level from your npm package.
 * Typically you just need to export your provider here, but you can choose to export more if you need to.
 */
export { ScaleProductsMcpProvider } from "./provider.js";

// Export models for external use if needed
export { AntipatternType } from "./models/antipattern-type.js";
export { Severity } from "./models/severity.js";
export type { ScanResult, AntipatternResult, DetectedAntipattern } from "./models/detection-result.js";
