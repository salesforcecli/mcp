import { AntipatternType } from "../models/antipattern-type.js";

/**
 * Base interface for all antipattern recommenders
 * Responsible for providing fix instructions for antipattern types
 */
export interface BaseRecommender {
  /**
   * Returns the type of antipattern this recommender handles
   */
  getAntipatternType(): AntipatternType;

  /**
   * Returns the fix instruction for this antipattern type
   * This instruction applies to all detected instances of this type
   */
  getFixInstruction(): string;
}
