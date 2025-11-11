import { BaseDetector } from "./base-detector.js";
import { DetectedAntipattern } from "../models/detection-result.js";
import { AntipatternType } from "../models/antipattern-type.js";
import { Severity } from "../models/severity.js";
import { ApexParserFactory, ApexParserBaseVisitor } from "@apexdevtools/apex-parser";
import type {
  QueryContext,
  ForStatementContext,
  WhileStatementContext,
  DoWhileStatementContext,
  MethodDeclarationContext,
} from "@apexdevtools/apex-parser";

/**
 * AST-based detector for SOQL queries without WHERE or LIMIT clauses
 * Uses apex-parser for accurate syntax tree analysis instead of regex
 */
export class SOQLNoWhereLimitDetector implements BaseDetector {
  public getAntipatternType(): AntipatternType {
    return AntipatternType.SOQL_NO_WHERE_LIMIT;
  }

  public detect(className: string, apexCode: string): DetectedAntipattern[] {
    const detections: DetectedAntipattern[] = [];

    try {
      // Create parser using the factory
      const parser = ApexParserFactory.createParser(apexCode);
      
      // Parse as a compilation unit (class file)
      const compilationUnit = parser.compilationUnit();

      // Create visitor to traverse the AST
      const visitor = new SOQLNoWhereLimitVisitor(className, apexCode, detections);
      visitor.visit(compilationUnit);
    } catch (error) {
      console.error(`Error parsing ${className}:`, error);
    }

    return detections;
  }
}

/**
 * Visitor class to traverse the AST and detect SOQL queries without WHERE/LIMIT
 */
class SOQLNoWhereLimitVisitor extends ApexParserBaseVisitor<void> {
  private loopDepth = 0;
  private currentMethodName?: string;

  constructor(
    private className: string,
    private apexCode: string,
    private detections: DetectedAntipattern[]
  ) {
    super();
  }

  /**
   * Visit method declarations to track context
   */
  visitMethodDeclaration(ctx: MethodDeclarationContext): void {
    // Save previous method name to handle nested contexts
    const previousMethodName = this.currentMethodName;
    
    // Try to get method name from id() first
    let methodName: string | undefined;
    if (ctx.id) {
      const idCtx = ctx.id();
      methodName = idCtx ? idCtx.getText() : undefined;
    }
    
    // Fallback: if id() returns empty or undefined, extract from FormalParametersContext
    // Parser behavior is inconsistent - sometimes puts name in id(), sometimes in parameters
    if (!methodName && ctx.getChildCount() > 0) {
      for (let i = 0; i < ctx.getChildCount(); i++) {
        const child = ctx.getChild(i);
        if (child && child.constructor.name === "FormalParametersContext") {
          // Extract method name from parameters text (e.g., "testMethod()")
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
    
    // Continue traversing children - this will visit method body
    this.visitChildren(ctx);
    
    // Restore previous method name
    this.currentMethodName = previousMethodName;
  }

  /**
   * Visit for statements to track loop context
   */
  visitForStatement(ctx: ForStatementContext): void {
    this.loopDepth++;
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
   * Visit SOQL queries - this is where we detect missing WHERE/LIMIT clauses
   */
  visitQuery(ctx: QueryContext): void {
    const queryText = ctx.getText();
    
    // Check if the query lacks WHERE or LIMIT clause
    if (this.detectNoWhereLimitInSOQL(queryText)) {
      const lineNumber = this.getLineNumber(ctx);
      const codeBefore = this.extractCodeSnippet(lineNumber);
      
      // Determine severity based on loop context
      // HIGH if in loop (more records processed repeatedly)
      // MEDIUM if outside loop
      const severity = this.loopDepth > 0 ? Severity.HIGH : Severity.MEDIUM;

      this.detections.push({
        className: this.className,
        methodName: this.currentMethodName,
        lineNumber,
        codeBefore,
        severity,
      });
    }

    // Continue traversing children to find nested queries
    this.visitChildren(ctx);
  }

  /**
   * Detects if a SOQL query lacks WHERE or LIMIT clauses
   * Handles both simple and nested SOQL queries
   * 
   * @param soqlQuery - The SOQL query text
   * @returns true if antipattern is detected (no WHERE and no LIMIT)
   */
  private detectNoWhereLimitInSOQL(soqlQuery: string): boolean {
    // Check if either WHERE or LIMIT clause exists
    const hasWhereOrLimit = /\b(WHERE|LIMIT)\b/i.test(soqlQuery);
    
    if (!hasWhereOrLimit) {
      // If neither WHERE nor LIMIT is found, it's an antipattern
      return true;
    }
    
    // Find all SELECT statements to determine if it's a nested query
    const selectMatches = soqlQuery.match(/\bSELECT\b/gi) || [];
    
    if (selectMatches.length === 1) {
      // Single SOQL with WHERE or LIMIT found, no antipattern
      return false;
    }
    
    // For nested SOQL, check only the outermost query
    // Remove subqueries (content within parentheses containing SELECT)
    const cleanedSoql = this.removeSubqueries(soqlQuery);
    const hasWhereOrLimitInOuter = /\b(WHERE|LIMIT)\b/i.test(cleanedSoql);
    
    // Return true if WHERE/LIMIT not found in outermost query
    return !hasWhereOrLimitInOuter;
  }

  /**
   * Remove nested subqueries to analyze only the outer query
   * 
   * @param soqlQuery - The SOQL query text
   * @returns Query with subqueries removed
   */
  private removeSubqueries(soqlQuery: string): string {
    // Remove content within parentheses that contains SELECT
    // This handles nested subqueries like: SELECT Id, (SELECT Name FROM Contacts) FROM Account
    return soqlQuery.replace(/\(\s*SELECT\s+[\s\S]*?\)/gi, '()');
  }

  /**
   * Extract line number from context
   */
  private getLineNumber(ctx: any): number {
    const token = ctx.start;
    return token ? token.line : 1;
  }

  /**
   * Extract a code snippet for the given line number
   */
  private extractCodeSnippet(lineNumber: number): string {
    const lines = this.apexCode.split('\n');
    const lineIndex = lineNumber - 1;
    
    if (lineIndex >= 0 && lineIndex < lines.length) {
      return lines[lineIndex].trim();
    }
    
    return '';
  }
}
