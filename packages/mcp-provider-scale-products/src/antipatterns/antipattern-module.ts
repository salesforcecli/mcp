import { BaseDetector } from "../detectors/base-detector.js";
import { BaseRecommender } from "../recommenders/base-recommender.js";
import { BaseRuntimeEnricher } from "../runtime-enrichers/base-runtime-enricher.js";
import { AntipatternResult, DetectedAntipattern } from "../models/detection-result.js";
import { AntipatternType } from "../models/antipattern-type.js";
import { ClassRuntimeData } from "../models/runtime-data.js";

/**
 * Antipattern Module couples a detector with an optional recommender and runtime enricher
 * Supports detection-only, detection+recommendation, and detection+enrichment workflows
 */
export class AntipatternModule {
  constructor(
    private readonly detector: BaseDetector,
    private readonly recommender?: BaseRecommender,
    private readonly runtimeEnricher?: BaseRuntimeEnricher
  ) {
    // Validate that detector and recommender handle the same antipattern type (if recommender exists)
    if (recommender && detector.getAntipatternType() !== recommender.getAntipatternType()) {
      throw new Error(
        `Detector and Recommender antipattern types must match. ` +
        `Detector: ${detector.getAntipatternType()}, ` +
        `Recommender: ${recommender.getAntipatternType()}`
      );
    }

    // Validate that detector type is supported by enricher (if enricher exists)
    if (runtimeEnricher) {
      const enricherTypes = runtimeEnricher.getAntipatternTypes();
      if (!enricherTypes.includes(detector.getAntipatternType())) {
        throw new Error(
          `RuntimeEnricher does not support detector antipattern type. ` +
          `Detector: ${detector.getAntipatternType()}, ` +
          `Enricher supports: ${enricherTypes.join(", ")}`
        );
      }
    }
  }

  /**
   * Gets the antipattern type this module handles
   */
  public getAntipatternType(): AntipatternType {
    return this.detector.getAntipatternType();
  }

  /**
   * Scans an Apex class for antipatterns and generates detection results
   * Optionally enriches detections with runtime data for severity calculation
   * 
   * @param className - Name of the Apex class
   * @param apexCode - The Apex class source code
   * @param runtimeData - Optional runtime data for enrichment (if available)
   * @returns AntipatternResult with all detections and a single fix instruction
   */
  public scan(
    className: string,
    apexCode: string,
    runtimeData?: ClassRuntimeData
  ): AntipatternResult {
    // Detect antipatterns (with static severity)
    let detectedInstances = this.detector.detect(className, apexCode);

    // Enrich with runtime data if available and enricher is configured
    if (runtimeData && this.runtimeEnricher && detectedInstances.length > 0) {
      detectedInstances = this.runtimeEnricher.enrich(
        detectedInstances,
        runtimeData,
        className
      );
    }

    // Get fix instruction for this antipattern type
    const fixInstruction = this.recommender
      ? this.recommender.getFixInstruction()
      : this.getDefaultInstruction();

    return {
      antipatternType: this.getAntipatternType(),
      fixInstruction,
      detectedInstances,
    };
  }

  /**
   * Returns default fix instruction when no recommender is configured
   */
  private getDefaultInstruction(): string {
    return `${this.getAntipatternType()} antipattern detected. Manual review and fix recommended.`;
  }

  /**
   * Checks if this module has a recommender configured
   */
  public hasRecommender(): boolean {
    return this.recommender !== undefined;
  }

  /**
   * Checks if this module has a runtime enricher configured
   */
  public hasRuntimeEnricher(): boolean {
    return this.runtimeEnricher !== undefined;
  }
}
