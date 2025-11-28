/**
 * This file dictates what is exported at the top level from your npm package.
 * Typically you just need to export your provider here, but you can choose to export more if you need to.
 */
export { ScaleProductsMcpProvider } from "./provider.js";

// Export models for external use if needed
export { AntipatternType } from "./models/antipattern-type.js";
export { Severity } from "./models/severity.js";
export type { ScanResult, AntipatternResult, DetectedAntipattern } from "./models/detection-result.js";
// Export detectors for external use
export { GGDDetector } from "./detectors/ggd-detector.js";

// Export AST utilities for external use
export { ApexAstUtils } from "./utils/apex-ast-utils.js";
export type {
  MethodInfo,
  LoopInfo,
  MethodCallInfo,
  QueryInfo,
  DMLInfo,
  ClassInfo,
} from "./utils/apex-ast-utils.js";
