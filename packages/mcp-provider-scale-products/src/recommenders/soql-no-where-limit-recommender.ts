import { BaseRecommender } from "./base-recommender.js";
import { AntipatternType } from "../models/antipattern-type.js";
import { getSOQLNoWhereLimitFixInstructions } from "../resources/fix-instructions/soql-no-where-limit-fix-instruction.js";

/**
 * Recommender for SOQL No WHERE/LIMIT antipattern
 */
export class SOQLNoWhereLimitRecommender implements BaseRecommender {
  public getAntipatternType(): AntipatternType {
    return AntipatternType.SOQL_NO_WHERE_LIMIT;
  }

  public getFixInstruction(): string {
    return getSOQLNoWhereLimitFixInstructions();
  }
}
