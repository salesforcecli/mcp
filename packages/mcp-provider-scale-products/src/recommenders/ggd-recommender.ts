import { BaseRecommender } from "./base-recommender.js";
import { AntipatternType } from "../models/antipattern-type.js";
import { GGD_FIX_INSTRUCTIONS } from "../resources/fix-instructions/ggd-fix-instructions.js";

/**
 * Recommender for Schema.getGlobalDescribe() antipattern
 * Provides fix instructions for GGD antipattern type
 */
export class GGDRecommender implements BaseRecommender {
  public getAntipatternType(): AntipatternType {
    return AntipatternType.GGD;
  }

  public getFixInstruction(): string {
    return GGD_FIX_INSTRUCTIONS;
  }
}
