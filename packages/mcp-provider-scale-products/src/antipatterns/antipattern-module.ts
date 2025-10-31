import { BaseDetector } from "../detectors/base-detector.js";
import { BaseRecommender } from "../recommenders/base-recommender.js";
import { AntipatternResult, DetectedAntipattern } from "../models/detection-result.js";
import { AntipatternType } from "../models/antipattern-type.js";

/**
 * Antipattern Module couples a detector with an optional recommender
 * Supports both detection-only and detection+recommendation workflows
 */
export class AntipatternModule {
  constructor(
    private readonly detector: BaseDetector,
    private readonly recommender?: BaseRecommender
  ) {
    // Validate that detector and recommender handle the same antipattern type (if recommender exists)
    if (recommender && detector.getAntipatternType() !== recommender.getAntipatternType()) {
      throw new Error(
        `Detector and Recommender antipattern types must match. ` +
        `Detector: ${detector.getAntipatternType()}, ` +
        `Recommender: ${recommender.getAntipatternType()}`
      );
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
   * @param className - Name of the Apex class
   * @param apexCode - The Apex class source code
   * @returns AntipatternResult with all detections and a single fix instruction
   */
  public scan(className: string, apexCode: string): AntipatternResult {
    // Detect antipatterns
    const detectedInstances = this.detector.detect(className, apexCode);

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
}
