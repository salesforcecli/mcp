/**
 * SOQL Unused Fields Recommender
 * Based on ApexGuru's fix generation logic
 * 
 * This recommender generates actual fixed SOQL queries by removing unused fields.
 * This is what makes SOQL Unused Fields different from other antipatterns -
 * it provides an actual fix, not just recommendations.
 */

import { BaseRecommender } from "./base-recommender.js";
import { DetectedAntipattern, AntipatternResult, SOQLUnusedFieldsMetadata } from "../models/detection-result.js";
import { AntipatternType } from "../models/antipattern-type.js";
import { SOQLParser } from "../utils/soql-parser.js";
import { SOQL_UNUSED_FIELDS_FIX_INSTRUCTION } from "../resources/fix-instructions/soql-unused-fields-fix-instruction.js";

/**
 * Recommender that generates optimized SOQL by removing unused fields
 */
export class SOQLUnusedFieldsRecommender implements BaseRecommender {
  public getAntipatternType(): AntipatternType {
    return AntipatternType.SOQL_UNUSED_FIELDS;
  }

  /**
   * Generate recommendations with actual fix code
   * This is the KEY METHOD that generates codeAfter
   * 
   * @param detections - Array of detected antipatterns
   * @returns AntipatternResult with fix instructions and optimized code
   */
  public recommend(detections: DetectedAntipattern[]): AntipatternResult {
    const instances = detections.map(detection => {
      const metadata = detection.metadata as SOQLUnusedFieldsMetadata;
      
      // CRITICAL: Generate the actual fixed SOQL (ApexGuru pattern)
      const codeAfter = this.generateFixedSOQL(
        detection.codeBefore,
        metadata.unusedFields,
        metadata.originalFields
      );

      return {
        className: detection.className,
        methodName: detection.methodName,
        lineNumber: detection.lineNumber,
        codeBefore: detection.codeBefore,
        codeAfter, 
        severity: detection.severity,
        unusedFields: metadata.unusedFields,
        originalFields: metadata.originalFields,
        metadata: detection.metadata,
      };
    });

    return {
      antipatternType: this.getAntipatternType(),
      fixInstruction: this.getFixInstruction(),
      detectedInstances: instances,
    };
  }

  /**
   * CRITICAL: Generate fixed SOQL by removing unused fields
   * Based on ApexGuru's remove_unused_fields_from_soql logic
   * 
   * Safety checks (ApexGuru patterns):
   * - Returns empty string for nested queries (too complex)
   * - Ensures at least one field remains
   * - Preserves FROM clause completely (WHERE, LIMIT, ORDER BY, etc.)
   * 
   * @param originalSOQL - Original SOQL query
   * @param unusedFields - Fields to remove
   * @param originalFields - All original fields
   * @returns Optimized SOQL or empty string if unsafe
   */
  private generateFixedSOQL(
    originalSOQL: string,
    unusedFields: string[],
    originalFields: string[]
  ): string {
    // ApexGuru safety check: Skip nested queries
    if (SOQLParser.hasNestedQueries(originalSOQL)) {
      console.warn('Nested queries detected, skipping fix generation');
      return '';
    }

    // ApexGuru safety check: Don't remove all fields
    if (unusedFields.length >= originalFields.length) {
      console.warn('Would remove all fields, skipping fix generation');
      return '';
    }

    // Generate optimized SOQL
    const optimizedSOQL = SOQLParser.removeUnusedFields(
      originalSOQL,
      unusedFields,
      originalFields
    );

    return optimizedSOQL;
  }

  /**
   * Get comprehensive fix instruction
   * Provides detailed guidance on how to optimize SOQL queries
   * 
   * @returns Fix instruction markdown
   */
  public getFixInstruction(): string {
    return SOQL_UNUSED_FIELDS_FIX_INSTRUCTION;
  }
}

