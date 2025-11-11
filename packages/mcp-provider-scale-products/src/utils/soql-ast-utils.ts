import { ApexParserFactory, ApexParserBaseVisitor } from "@apexdevtools/apex-parser";
import type {
  QueryContext,
  MethodDeclarationContext,
  ForStatementContext,
  WhileStatementContext,
  DoWhileStatementContext,
} from "@apexdevtools/apex-parser";

/**
 * Information about a SOQL query found in Apex code
 */
export interface SOQLQueryInfo {
  /** The full SOQL query text */
  query: string;
  /** Line number where the query starts */
  lineNumber: number;
  /** Method name containing the query (if available) */
  methodName?: string;
  /** Whether the query is inside a loop */
  inLoop: boolean;
}

/**
 * Utility class for SOQL query extraction and analysis using AST
 */
export class SOQLAstUtils {
  /**
   * Extract all SOQL queries from Apex code using AST parsing
   * 
   * @param apexCode - The Apex code to analyze
   * @returns Array of SOQL query information
   */
  public static extractSOQLQueries(apexCode: string): SOQLQueryInfo[] {
    try {
      const parser = ApexParserFactory.createParser(apexCode);
      const compilationUnit = parser.compilationUnit();
      
      const visitor = new SOQLExtractorVisitor();
      visitor.visit(compilationUnit);
      
      return visitor.queries;
    } catch (error) {
      console.error("Error parsing Apex code for SOQL queries:", error);
      return [];
    }
  }

  /**
   * Check if a SOQL query has a WHERE clause
   * 
   * @param soqlQuery - The SOQL query text
   * @returns true if WHERE clause is present
   */
  public static hasWhereClause(soqlQuery: string): boolean {
    // Remove nested subqueries to avoid false positives
    const cleanedQuery = this.removeSubqueries(soqlQuery);
    
    // Check for WHERE keyword in the main query (case-insensitive)
    return /\bWHERE\b/i.test(cleanedQuery);
  }

  /**
   * Check if a SOQL query has a LIMIT clause
   * 
   * @param soqlQuery - The SOQL query text
   * @returns true if LIMIT clause is present
   */
  public static hasLimitClause(soqlQuery: string): boolean {
    // Remove nested subqueries to avoid false positives
    const cleanedQuery = this.removeSubqueries(soqlQuery);
    
    // Check for LIMIT keyword in the main query (case-insensitive)
    return /\bLIMIT\b/i.test(cleanedQuery);
  }

  /**
   * Remove nested subqueries from a SOQL query to analyze only the outer query
   * 
   * @param soqlQuery - The SOQL query text
   * @returns Query with subqueries removed
   */
  private static removeSubqueries(soqlQuery: string): string {
    // Remove content within parentheses that contains SELECT
    // This handles nested subqueries like: SELECT Id, (SELECT Name FROM Contacts) FROM Account
    return soqlQuery.replace(/\(\s*SELECT\s+[\s\S]*?\)/gi, '()');
  }
}

/**
 * Visitor class to traverse the AST and extract SOQL queries
 */
class SOQLExtractorVisitor extends ApexParserBaseVisitor<void> {
  public queries: SOQLQueryInfo[] = [];
  private loopDepth = 0;
  private currentMethodName?: string;

  /**
   * Visit method declarations to track context
   */
  visitMethodDeclaration(ctx: MethodDeclarationContext): void {
    const previousMethodName = this.currentMethodName;
    
    // Try to get method name from id() first
    let methodName: string | undefined;
    if (ctx.id) {
      const idCtx = ctx.id();
      methodName = idCtx ? idCtx.getText() : undefined;
    }
    
    // Fallback: extract from FormalParametersContext if needed
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
   * Visit SOQL queries - this is where we extract query information
   */
  visitQuery(ctx: QueryContext): void {
    const queryText = ctx.getText();
    const lineNumber = this.getLineNumber(ctx);
    
    this.queries.push({
      query: queryText,
      lineNumber,
      methodName: this.currentMethodName,
      inLoop: this.loopDepth > 0,
    });

    // Continue traversing children to find nested queries
    this.visitChildren(ctx);
  }

  /**
   * Extract line number from context
   */
  private getLineNumber(ctx: any): number {
    const token = ctx.start;
    return token ? token.line : 1;
  }
}

