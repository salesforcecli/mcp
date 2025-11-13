/**
 * SOQL Unused Fields Detector
 * 
 * This detector identifies SOQL queries that select fields which are never used in subsequent code.
 * It implements sophisticated analysis patterns including:
 * - Variable assignment tracking with 2-line distance rule
 * - Special FOR loop handling
 * - Smart exclusions (returns, class members, complete usage)
 * - Cross-SOQL field usage detection
 * - System field exclusions
 */

import { BaseDetector } from "./base-detector.js";
import { DetectedAntipattern, SOQLUnusedFieldsMetadata } from "../models/detection-result.js";
import { AntipatternType } from "../models/antipattern-type.js";
import { Severity } from "../models/severity.js";
import { SOQLParser } from "../utils/soql-parser.js";
import { SOQLFieldTracker } from "../utils/soql-field-tracker.js";
import { ApexParserFactory, ApexParserBaseVisitor } from "@apexdevtools/apex-parser";
import type {
  QueryContext,
  MethodDeclarationContext,
  ForStatementContext,
  WhileStatementContext,
  DoWhileStatementContext,
} from "@apexdevtools/apex-parser";

/**
 * Information about a SOQL query with tracking info
 */
interface SOQLQueryInfo {
  query: string;
  lineNumber: number;
  endLineNumber: number;
  methodName?: string;
  isInLoop: boolean;
  fields: string[];
  assignedVariable?: string | null;
}

/**
 * SOQL Unused Fields Detector
 * Implements ApexGuru's unused fields detection with all exclusion patterns
 */
export class SOQLUnusedFieldsDetector implements BaseDetector {
  public getAntipatternType(): AntipatternType {
    return AntipatternType.SOQL_UNUSED_FIELDS;
  }

  /**
   * Main detection method
   * Analysis flow:
   * 1. Parse AST using apex-parser
   * 2. Extract all SOQLs with assigned variables
   * 3. Apply exclusion logic
   * 4. Analyze field usage
   * 5. Return detections
   * 
   * @param className - Name of the Apex class
   * @param apexCode - Full Apex class code
   * @returns Array of detected antipatterns with unused fields
   */
  public detect(className: string, apexCode: string): DetectedAntipattern[] {
    try {
      // Parse using real apex-parser
      const parser = ApexParserFactory.createParser(apexCode);
      const compilationUnit = parser.compilationUnit();

      // Extract SOQL queries with assigned variables using visitor
      const visitor = new SOQLUnusedFieldsVisitor(apexCode);
      visitor.visit(compilationUnit);

      const detections: DetectedAntipattern[] = [];

      // Analyze each SOQL for unused fields
      for (const soql of visitor.soqlQueries) {
        const assignedVar = soql.assignedVariable;

        // CRITICAL: Apply exclusion logic
        if (this.shouldSkipAnalysis(assignedVar, soql, apexCode, visitor.classFields)) {
          continue;
        }

        // Find unused fields
        const unusedFields = this.findUnusedFields(soql, assignedVar!, apexCode, visitor.soqlQueries);

        if (unusedFields.length > 0 && unusedFields.length < soql.fields.length) {
          // Found unused fields (but not all fields are unused)
          const metadata = this.buildMetadata(soql, assignedVar, unusedFields, apexCode, visitor.soqlQueries);

          detections.push({
            className,
            methodName: soql.methodName,
            lineNumber: soql.lineNumber,
            codeBefore: this.formatQueryForDisplay(soql.query),
            severity: soql.isInLoop ? Severity.HIGH : Severity.MEDIUM,
            metadata,
          });
        }
      }

      return detections;
    } catch (error) {
      console.error(`Error detecting unused fields in ${className}:`, error);
      return [];
    }
  }

  /**
   * Format query for display (truncate if too long)
   */
  private formatQueryForDisplay(query: string): string {
    const cleaned = query.replace(/\s+/g, ' ').trim();
    if (cleaned.length > 200) {
      return cleaned.substring(0, 197) + '...';
    }
    return cleaned;
  }

  /**
   * CRITICAL: Determines if SOQL analysis should be skipped
   * Implements all exclusion patterns to avoid false positives
   * 
   * Skip conditions:
   * 1. No assigned variable found
   * 2. Variable is returned from method
   * 3. Variable is a class member field
   * 4. Complete SOQL results are used (not individual fields)
   * 
   * @param assignedVar - Variable name or null
   * @param soql - SOQL query information
   * @param apexCode - Full code for analysis
   * @param classFields - Class-level field names
   * @returns true if analysis should be skipped
   */
  private shouldSkipAnalysis(
    assignedVar: string | null | undefined,
    soql: SOQLQueryInfo,
    apexCode: string,
    classFields: string[]
  ): boolean {
    // 1. Exclusion: No assigned variable
    if (!assignedVar) {
      return true;
    }

    // 2. Exclusion: Variable is returned
    if (SOQLFieldTracker.isReturnedInCode(assignedVar, apexCode)) {
      return true;
    }

    // 3. Exclusion: Variable is class member (challenging to analyze)
    if (classFields.includes(assignedVar)) {
      return true;
    }

    // 4. Exclusion: Complete SOQL results are used
    if (SOQLFieldTracker.checkIfCompleteSOQLResultsAreUsed(
      assignedVar,
      apexCode,
      soql.endLineNumber,
      1, // methodStartLine - simplified for now
      soql.fields
    )) {
      return true;
    }

    return false;
  }

  /**
   * Find unused fields in a SOQL query
   * 
   * Analysis steps:
   * 1. Extract all fields from SOQL
   * 2. Exclude system fields (Id, COUNT())
   * 3. Find fields used via direct access (var.Field)
   * 4. Find fields used in later SOQLs
   * 5. Return fields that are not used
   * 
   * @param soql - SOQL query information
   * @param varName - Variable holding SOQL results
   * @param apexCode - Full code
   * @param allSoqls - All SOQL queries in the class
   * @returns Array of unused field names
   */
  private findUnusedFields(
    soql: SOQLQueryInfo,
    varName: string,
    apexCode: string,
    allSoqls: SOQLQueryInfo[]
  ): string[] {
    // Exclude system fields
    let fields: Set<string> = new Set<string>(soql.fields);
    fields = SOQLParser.excludeSystemFields(fields);

    if (fields.size === 0) {
      return []; // No fields to analyze
    }

    // Find fields used via direct member access (e.g., acc.Name)
    const codeAfterSOQL = this.getCodeAfterLine(apexCode, soql.endLineNumber);
    const fieldsArray: string[] = Array.from(fields);
    const directlyUsedFields = SOQLFieldTracker.findDirectFieldAccess(
      varName,
      codeAfterSOQL,
      fieldsArray
    );

    // Find fields used in subsequent SOQLs
    const laterSOQLs = allSoqls
      .filter(s => s.lineNumber > soql.lineNumber)
      .map(s => ({ query: s.query, lineNumber: s.lineNumber }));
    const usedInLaterSOQLs = SOQLFieldTracker.findColumnsUsedInLaterSOQLs(
      varName,
      laterSOQLs,
      fieldsArray
    );

    // Combine all used fields
    const allUsedFields = new Set<string>([...directlyUsedFields, ...usedInLaterSOQLs]);

    // Return fields that are NOT used
    const unusedFields: string[] = fieldsArray.filter(f => !allUsedFields.has(f));
    return unusedFields;
  }

  /**
   * Build metadata for detection result
   * Provides context for fix generation and display
   * 
   * @param soql - SOQL query information
   * @param assignedVar - Assigned variable name
   * @param unusedFields - Fields that are unused
   * @param apexCode - Full code
   * @param allSoqls - All SOQL queries in the class
   * @returns Metadata object
   */
  private buildMetadata(
    soql: SOQLQueryInfo,
    assignedVar: string | null | undefined,
    unusedFields: string[],
    apexCode: string,
    allSoqls: SOQLQueryInfo[]
  ): SOQLUnusedFieldsMetadata {
    const laterSOQLs = allSoqls
      .filter(s => s.lineNumber > soql.lineNumber)
      .map(s => ({ query: s.query, lineNumber: s.lineNumber }));
    
    const usedInLaterSOQLs: string[] = assignedVar 
      ? SOQLFieldTracker.findColumnsUsedInLaterSOQLs(assignedVar, laterSOQLs, soql.fields)
      : [];

    const completeUsageDetected: boolean = assignedVar
      ? SOQLFieldTracker.checkIfCompleteSOQLResultsAreUsed(
          assignedVar, apexCode, soql.endLineNumber, 1, soql.fields
        )
      : false;

    return {
      unusedFields,
      originalFields: soql.fields,
      assignedVariable: assignedVar ?? null,
      isInLoop: soql.isInLoop,
      isReturned: assignedVar ? SOQLFieldTracker.isReturnedInCode(assignedVar, apexCode) : false,
      isClassMember: false, // Already checked in skip logic
      hasNestedQueries: SOQLParser.hasNestedQueries(soql.query),
      usedInLaterSOQLs,
      completeUsageDetected,
    };
  }

  /**
   * Get code text after a specific line
   * Used for analyzing field usage
   */
  private getCodeAfterLine(apexCode: string, afterLine: number): string {
    const lines = apexCode.split('\n');
    return lines.slice(afterLine).join('\n');
  }

}

/**
 * Visitor class to traverse the AST and extract SOQL queries with their assigned variables
 * Implements variable tracking logic with 2-line distance rule
 */
class SOQLUnusedFieldsVisitor extends ApexParserBaseVisitor<void> {
  public soqlQueries: SOQLQueryInfo[] = [];
  public classFields: string[] = [];
  
  private loopDepth = 0;
  private currentMethodName?: string;
  private lastVariableDeclaration?: {
    name: string;
    lineNumber: number;
  };

  constructor(private apexCode: string) {
    super();
  }

  /**
   * Visit method declarations to track context
   */
  visitMethodDeclaration(ctx: MethodDeclarationContext): void {
    const previousMethodName = this.currentMethodName;
    
    // Extract method name
    let methodName: string | undefined;
    if (ctx.id) {
      const idCtx = ctx.id();
      methodName = idCtx ? idCtx.getText() : undefined;
    }
    
    // Fallback: extract from FormalParametersContext
    if (!methodName && ctx.getChildCount() > 0) {
      for (let i = 0; i < ctx.getChildCount(); i++) {
        const child = ctx.getChild(i);
        if (child && child.constructor.name === "FormalParametersContext") {
          const text = child.getText();
          const match = text.match(/^(\w+)\(/);
          if (match) {
            methodName = match[1];
            break;
          }
        }
      }
    }
    
    this.currentMethodName = methodName;
    this.visitChildren(ctx);
    this.currentMethodName = previousMethodName;
  }

  /**
   * Visit all nodes to track variable declarations
   * Generic approach to catch all variable declarations
   */
  visitChildren(node: any): void {
    // Try to extract variable declarations from any node
    if (node && node.start) {
      const nodeName = node.constructor?.name || '';
      
      // Check if this is a variable declaration node
      if (nodeName.includes('LocalVariable') || nodeName.includes('VariableDeclaration')) {
        // Try to access the structure properly
        try {
          // Method 1: Try localVariableDeclaration structure
          if (typeof node.localVariableDeclaration === 'function') {
            const localVarDecl = node.localVariableDeclaration();
            if (localVarDecl && typeof localVarDecl.variableDeclarators === 'function') {
              const varDeclarators = localVarDecl.variableDeclarators();
              // ANTLR returns lists with _list suffix
              if (varDeclarators && typeof varDeclarators.variableDeclarator_list === 'function') {
                const declaratorList = varDeclarators.variableDeclarator_list();
                if (declaratorList && declaratorList.length > 0) {
                  const firstDeclarator = declaratorList[0];
                  if (firstDeclarator && typeof firstDeclarator.id === 'function') {
                    const idNode = firstDeclarator.id();
                    if (idNode) {
                      const varName = idNode.getText();
                      const lineNumber = node.start.line;
                      if (lineNumber > 0 && varName && varName.length > 0) {
                        this.lastVariableDeclaration = { name: varName, lineNumber };
                      }
                    }
                  }
                }
              }
            }
          }
          
          // Method 2: Try to get id() directly (for VariableDeclarator nodes)
          if (!this.lastVariableDeclaration || this.lastVariableDeclaration.lineNumber !== node.start.line) {
            if (typeof node.id === 'function') {
              const idNode = node.id();
              if (idNode) {
                const varName = idNode.getText();
                const lineNumber = node.start.line;
                if (lineNumber > 0 && varName && varName.length > 0) {
                  this.lastVariableDeclaration = { name: varName, lineNumber };
                }
              }
            }
          }
        } catch (error) {
          // Silently ignore errors in variable extraction
        }
      }
    }
    
    super.visitChildren(node);
  }

  /**
   * Visit for statements to track loop context and handle for-each SOQL
   */
  visitForStatement(ctx: ForStatementContext): void {
    this.loopDepth++;
    
    // Check if this is a for-each loop with SOQL
    // Pattern: for (Type var : [SELECT ...])
    try {
      // Try to access the for control structure
      const ctxAny = ctx as any;
      if (typeof ctxAny.forControl === 'function') {
        const forControl = ctxAny.forControl();
        
        // Check if it's an enhanced for loop (for-each)
        if (forControl && typeof forControl.enhancedForControl === 'function') {
          const enhancedFor = forControl.enhancedForControl();
          if (enhancedFor && typeof enhancedFor.id === 'function') {
            const idNode = enhancedFor.id();
            if (idNode) {
              const loopVar = idNode.getText();
              const lineNumber = this.getLineNumber(ctx);
              this.lastVariableDeclaration = { name: loopVar, lineNumber };
            }
          }
        }
      }
    } catch (error) {
      // Silently ignore errors in for control extraction
    }
    
    this.visitChildren(ctx);
    this.loopDepth--;
  }

  /**
   * Visit while statements to track loop context
   */
  visitWhileStatement(ctx: WhileStatementContext): void {
    this.loopDepth++;
    this.visitChildren(ctx);
    this.loopDepth--;
  }

  /**
   * Visit do-while statements to track loop context
   */
  visitDoWhileStatement(ctx: DoWhileStatementContext): void {
    this.loopDepth++;
    this.visitChildren(ctx);
    this.loopDepth--;
  }

  /**
   * Visit SOQL queries - extract query and track assigned variable
   */
  visitQuery(ctx: QueryContext): void {
    const queryText = ctx.getText();
    const lineNumber = this.getLineNumber(ctx);
    const endLineNumber = this.getEndLineNumber(ctx);
    
    // Extract fields from the query
    const fields = SOQLParser.extractFields(queryText);
    
    // Determine assigned variable using 2-line distance rule
    let assignedVariable: string | null = null;
    if (this.lastVariableDeclaration) {
      const distance = lineNumber - this.lastVariableDeclaration.lineNumber;
      if (distance <= 2) {
        assignedVariable = this.lastVariableDeclaration.name;
      }
    }
    
    this.soqlQueries.push({
      query: queryText,
      lineNumber,
      endLineNumber,
      methodName: this.currentMethodName,
      isInLoop: this.loopDepth > 0,
      fields,
      assignedVariable,
    });

    // Continue traversing children to find nested queries
    this.visitChildren(ctx);
  }

  /**
   * Extract line number from context (start line)
   */
  private getLineNumber(ctx: any): number {
    const token = ctx.start;
    return token ? token.line : 1;
  }

  /**
   * Extract end line number from context
   */
  private getEndLineNumber(ctx: any): number {
    const token = ctx.stop;
    return token ? token.line : this.getLineNumber(ctx);
  }
}

