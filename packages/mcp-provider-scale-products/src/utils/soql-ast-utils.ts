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
  /** Line number where the query starts (1-based) */
  lineNumber: number;
  /** Line number where the query ends (1-based) */
  endLineNumber: number;
  /** Method name containing the query (if available) */
  methodName?: string;
  /** Whether the query is inside a loop */
  inLoop: boolean;
  /** Whether the query has WHERE clause */
  hasWhere: boolean;
  /** Whether the query has LIMIT clause */
  hasLimit: boolean;
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
      
      const visitor = new SOQLExtractorVisitor(apexCode);
      visitor.visit(compilationUnit);
      
      return visitor.queries;
    } catch (error) {
      console.error("Error parsing Apex code for SOQL queries:", error);
      return [];
    }
  }

  /**
   * Check if a SOQL query has a WHERE clause
   * Handles nested subqueries - only checks the outer query
   * 
   * @param soqlQuery - The SOQL query text
   * @returns true if WHERE clause is present in the outer query
   */
  public static hasWhereClause(soqlQuery: string): boolean {
    // Remove nested subqueries to avoid false positives
    const cleanedQuery = this.removeSubqueries(soqlQuery);
    
    // Check for WHERE keyword in the main query (case-insensitive)
    // Use word boundaries to match exact keyword
    return /\bWHERE\b/i.test(cleanedQuery);
  }

  /**
   * Check if a SOQL query has a LIMIT clause
   * Handles nested subqueries - only checks the outer query
   * 
   * @param soqlQuery - The SOQL query text
   * @returns true if LIMIT clause is present in the outer query
   */
  public static hasLimitClause(soqlQuery: string): boolean {
    // Remove nested subqueries to avoid false positives
    const cleanedQuery = this.removeSubqueries(soqlQuery);
    
    // Check for LIMIT keyword in the main query (case-insensitive)
    // Use word boundaries to match exact keyword
    return /\bLIMIT\b/i.test(cleanedQuery);
  }

  /**
   * Check if query lacks both WHERE and LIMIT clauses
   * This is the main antipattern detector
   * 
   * @param soqlQuery - The SOQL query text
   * @returns true if query lacks both WHERE and LIMIT
   */
  public static lacksWhereAndLimit(soqlQuery: string): boolean {
    return !this.hasWhereClause(soqlQuery) && !this.hasLimitClause(soqlQuery);
  }

  /**
   * Remove nested subqueries from a SOQL query to analyze only the outer query
   * Handles patterns like: SELECT Id, (SELECT Name FROM Contacts) FROM Account
   * 
   * @param soqlQuery - The SOQL query text
   * @returns Query with subqueries removed
   */
  public static removeSubqueries(soqlQuery: string): string {
    // Remove content within parentheses that contains SELECT
    // This handles nested subqueries by replacing them with empty parentheses
    return soqlQuery.replace(/\(\s*SELECT\s+[\s\S]*?\)/gi, '()');
  }

  /**
   * Remove comments from code while preserving line structure
   * 
   * @param code - Apex code
   * @returns Code without comments
   */
  public static removeComments(code: string): string {
    // Remove block comments /* ... */
    let result = code.replace(/\/\*[\s\S]*?\*\//g, ' ');
    
    // Remove single-line comments // ...
    result = result.replace(/\/\/.*$/gm, ' ');
    
    return result;
  }
}

/**
 * Visitor class to traverse the AST and extract SOQL queries
 */
class SOQLExtractorVisitor extends ApexParserBaseVisitor<void> {
  public queries: SOQLQueryInfo[] = [];
  private loopDepth = 0;
  private currentMethodName?: string;

  constructor(private apexCode: string) {
    super();
  }

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
    // Parser behavior can be inconsistent
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
    const endLineNumber = this.getEndLineNumber(ctx);
    
    // Check for WHERE and LIMIT using AST structure, not regex!
    // ctx.getText() compresses whitespace, breaking word boundary regex
    const hasWhere = this.hasWhereInQuery(ctx);
    const hasLimit = this.hasLimitInQuery(ctx);
    
    this.queries.push({
      query: queryText,
      lineNumber,
      endLineNumber,
      methodName: this.currentMethodName,
      inLoop: this.loopDepth > 0,
      hasWhere,
      hasLimit,
    });

    // Continue traversing children to find nested queries
    this.visitChildren(ctx);
  }

  /**
   * Check if QueryContext has a WHERE clause by inspecting AST structure
   * More reliable than regex on compressed text
   */
  private hasWhereInQuery(ctx: QueryContext): boolean {
    // Check if whereClause() method exists and returns non-null
    if (ctx.whereClause && typeof ctx.whereClause === 'function') {
      const whereClause = ctx.whereClause();
      return whereClause !== null && whereClause !== undefined;
    }
    
    // Fallback: check children for WhereClauseContext
    for (let i = 0; i < ctx.getChildCount(); i++) {
      const child = ctx.getChild(i);
      if (child && child.constructor.name === 'WhereClauseContext') {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if QueryContext has a LIMIT clause by inspecting AST structure
   * More reliable than regex on compressed text
   */
  private hasLimitInQuery(ctx: QueryContext): boolean {
    // Check if limitClause() method exists and returns non-null
    if (ctx.limitClause && typeof ctx.limitClause === 'function') {
      const limitClause = ctx.limitClause();
      return limitClause !== null && limitClause !== undefined;
    }
    
    // Fallback: check children for LimitClauseContext
    for (let i = 0; i < ctx.getChildCount(); i++) {
      const child = ctx.getChild(i);
      if (child && child.constructor.name === 'LimitClauseContext') {
        return true;
      }
    }
    
    return false;
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
