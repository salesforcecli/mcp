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

/**
 * SOQL Parser for extracting field names and reconstructing optimized queries
 * Implements patterns for maximum compatibility
 */
export class SOQLParser {
  /**
   * Extract field names from SOQL SELECT clause
   * 
   * @param soqlQuery - The SOQL query string
   * @returns Array of field names extracted from SELECT clause
   * 
   * @example
   * extractFields("[SELECT Id, Name, Phone FROM Account]")
   * // Returns: ["Id", "Name", "Phone"]
   */
  public static extractFields(soqlQuery: string): string[] {
    // Pattern: SELECT\s*(.*?)\s*FROM\s*
    // Use \s* (zero or more spaces) to handle various whitespace patterns
    const pattern = /SELECT\s*(.*?)\s*FROM\s*/gi;
    const matches = [...soqlQuery.matchAll(pattern)];

    if (matches.length === 0) {
      return [];
    }

    const columnNames: string[] = [];

    for (const match of matches) {
      // Extract the fields section between SELECT and FROM
      const fieldsSection = match[1];
      
      // Split by comma to get individual fields
      const columns = fieldsSection.split(',');

      for (const column of columns) {
        const trimmed = column.trim();
        
        // Handle aliases and get the actual field name
        // Takes the last part after splitting by whitespace
        const parts = trimmed.split(/\s+/);
        const columnName = parts[parts.length - 1];

        // Exclude 'as' keyword
        if (columnName.toLowerCase() !== 'as') {
          columnNames.push(columnName);
        }
      }
    }

    return columnNames;
  }

  /**
   * Check if SOQL query contains nested subqueries
   * Detect if SELECT/FROM appears more than once
   * 
   * @param soqlText - The SOQL query string
   * @returns true if nested queries are detected
   * 
   * @example
   * hasNestedQueries("[SELECT Id, (SELECT Name FROM Contacts) FROM Account]")
   * // Returns: true
   */
  public static hasNestedQueries(soqlText: string): boolean {
    const selectCount = (soqlText.match(/SELECT/gi) || []).length;
    const fromCount = (soqlText.match(/FROM/gi) || []).length;

    // More than one SELECT and FROM indicates nested queries
    return selectCount > 1 && fromCount > 1;
  }

  /**
   * Remove unused fields from SOQL query and reconstruct
   * 
   * Safety patterns:
   * - Returns empty string for nested queries (too complex to optimize)
   * - Ensures at least one field remains after removal
   * - Preserves the entire FROM clause including WHERE, LIMIT, etc.
   * 
   * @param soqlText - Original SOQL query
   * @param unusedFields - Fields to remove
   * @param originalColumns - All fields in original query
   * @returns Optimized SOQL query, or empty string if optimization is unsafe
   * 
   * @example
   * removeUnusedFields(
   *   "[SELECT Id, Name, Phone FROM Account]",
   *   ["Phone"],
   *   ["Id", "Name", "Phone"]
   * )
   * // Returns: "[SELECT Id, Name FROM Account]"
   */
  public static removeUnusedFields(
    soqlText: string,
    unusedFields: string[],
    originalColumns: string[]
  ): string {
    // Safety check: Skip nested queries
    if (this.hasNestedQueries(soqlText)) {
      console.warn('SOQL contains nested queries, skipping optimization for safety');
      return '';
    }

    // Split by FROM keyword (case-insensitive)
    const splitPattern = / FROM /i;
    const parts = soqlText.split(splitPattern);

    if (parts.length < 2) {
      console.error('Invalid SOQL format: missing FROM clause');
      return '';
    }

    // Remove unused fields from the original column list
    const updatedFields = originalColumns.filter(
      field => !unusedFields.includes(field)
    );

    // Safety check: Ensure at least one field remains
    if (updatedFields.length === 0) {
      console.warn('All fields would be removed, skipping optimization');
      return '';
    }

    // Reconstruct the query with optimized field list
    // Preserve everything after FROM (including WHERE, LIMIT, ORDER BY, etc.)
    const reconstructed = `SELECT ${updatedFields.join(', ')} FROM ${parts[1]}`;
    
    return reconstructed;
  }

  /**
   * Exclude system fields from field analysis
   * Exclude Id, COUNT() and similar system fields
   * 
   * These fields are excluded because:
   * - Id: Often required even if not explicitly used
   * - COUNT(): Aggregate functions, different usage pattern
   * 
   * @param columnNames - Set of field names
   * @returns Set with system fields removed
   * 
   * @example
   * excludeSystemFields(new Set(["Id", "Name", "COUNT()"]))
   * // Returns: Set(["Name"])
   */
  public static excludeSystemFields(columnNames: Set<string>): Set<string> {
    // System fields exclusion list
    const systemFields = [
      'id',
      'ID', 
      'Id',
      'COUNT()',
      'count()',
    ];

    systemFields.forEach(field => {
      columnNames.delete(field);
    });

    return columnNames;
  }

  /**
   * Check if a SOQL query appears to be valid
   * Basic validation for SOQL structure
   * 
   * @param soqlText - The SOQL query string
   * @returns true if query has basic SOQL structure
   */
  public static isValidSOQL(soqlText: string): boolean {
    // Must contain SELECT and FROM keywords
    const hasSelect = /SELECT/i.test(soqlText);
    const hasFrom = /FROM/i.test(soqlText);
    
    return hasSelect && hasFrom;
  }

  /**
   * Extract the FROM clause (object name) from SOQL
   * 
   * @param soqlText - The SOQL query string
   * @returns Object name or null if not found
   * 
   * @example
   * extractObjectName("[SELECT Id FROM Account WHERE Name = 'Test']")
   * // Returns: "Account"
   */
  public static extractObjectName(soqlText: string): string | null {
    const pattern = /FROM\s+(\w+)/i;
    const match = soqlText.match(pattern);
    return match ? match[1] : null;
  }
}

/**
 * Tracks SOQL field usage patterns to determine which fields are actually used
 * Implements check_if_soql_results_are_used and find_columns_used_in_soqls logic
 */
export class SOQLFieldTracker {
  /**
   * Check if complete SOQL results are used (not individual fields)
   * 
   * Avoids false positives. When the complete SOQL result
   * is passed around or returned, we cannot safely optimize it.
   * 
   * Key patterns:
   * 1. Detects patterns like: variable; variable) variable[0]; variable,
   * 2. Excludes special methods: .isEmpty(), .size(), != null
   * 3. Checks for member access vs complete usage
   * 
   * @param varName - Variable name holding SOQL results
   * @param methodCode - Full method code as string
   * @param soqlEndLine - Line where SOQL ends
   * @param methodStartLine - Line where method starts
   * @param originalColumns - Fields selected in SOQL
   * @returns true if complete results are used, false if only individual fields used
   * 
   * @example
   * // Complete usage: return accounts; → true
   * // Field usage: return accounts[0].Name; → false
   */
  public static checkIfCompleteSOQLResultsAreUsed(
    varName: string,
    methodCode: string,
    soqlEndLine: number,
    methodStartLine: number,
    originalColumns: string[]
  ): boolean {
    // Extract code after the SOQL query
    const lines = methodCode.split('\n');
    const afterSOQLLines = lines.slice(soqlEndLine - methodStartLine);
    const restCode = afterSOQLLines.join('\n');

    // Remove comments to avoid false matches
    const codeNoComment = restCode.replace(
      /(\/\*[\s\S]*?\*\/)|(\/\/.*$)/gm,
      ''
    );

    // Check for INSERT DML - this means ALL fields are being used (complete usage)
    const insertPattern = new RegExp(`insert\\s+${this.escapeRegex(varName)}\\s*;`, 'gi');
    if (insertPattern.test(codeNoComment)) {
      return true; // INSERT uses all fields
    }

    // Remove special method calls that don't indicate complete usage
    let cleanedCode = codeNoComment
      .replace(new RegExp(`${this.escapeRegex(varName)}\\.isEmpty\\(\\)`, 'g'), '')
      .replace(new RegExp(`${this.escapeRegex(varName)}\\s*!=\\s*null`, 'g'), '')
      .replace(new RegExp(`${this.escapeRegex(varName)}\\.size\\(\\)`, 'g'), '')
      // Remove for-each loops - iterating over collection is NOT complete usage
      .replace(new RegExp(`for\\s*\\([^:]*:\\s*${this.escapeRegex(varName)}\\s*\\)`, 'gi'), '')
      // Exclude UPDATE/DELETE/UPSERT - they only need Id field, not complete usage
      .replace(new RegExp(`(delete|update|upsert)\\s+${this.escapeRegex(varName)}\\s*;`, 'gi'), '');

    // Check for complete usage patterns
    const completeUsagePatterns = [
      // Simple complete usage: var;  var)  var,
      new RegExp(`\\b${this.escapeRegex(varName)}\\b\\s*[,;)]`),
      // Array/collection usage: var[0];  var[0])  var[0],
      new RegExp(`\\b${this.escapeRegex(varName)}\\s*\\[\\d+\\]\\s*[,;)]`),
    ];

    // Check if any complete usage pattern matches
    for (const pattern of completeUsagePatterns) {
      if (pattern.test(cleanedCode)) {
        // Found complete usage, but verify it's not followed by member access
        const matches = cleanedCode.match(pattern);
        if (matches) {
          // Additional check: ensure it's not like var[0].Field
          const memberAccessPattern = new RegExp(
            `\\b${this.escapeRegex(varName)}(\\[\\d+\\])?\\.\\w+`,
            'g'
          );
          const memberMatches = cleanedCode.match(memberAccessPattern);
          
          if (memberMatches) {
            // Check if member accesses are for actual SOQL fields
            let hasRealFieldAccess = false;
            for (const memberMatch of memberMatches) {
              const fieldAccessPattern = /\.(\w+)/;
              const fieldMatch = memberMatch.match(fieldAccessPattern);
              if (fieldMatch) {
                const accessedField = fieldMatch[1];
                // If accessing a field that was in the SOQL, it's field usage
                if (originalColumns.some(col => col.toLowerCase() === accessedField.toLowerCase())) {
                  hasRealFieldAccess = true;
                }
              }
            }
            
            if (hasRealFieldAccess) {
              // Has field-level access, not complete usage
              continue;
            }
          }
          
          return true; // Complete usage detected
        }
      }
    }

    return false; // Only field-level usage detected
  }

  /**
   * Find columns that are used in subsequent SOQL queries
   * 
   * This is important because fields might be used to construct later queries
   * even if they're not directly accessed in the code.
   * 
   * Example:
   * Account acc = [SELECT Id, ParentId FROM Account LIMIT 1];
   * List<Account> children = [SELECT Id FROM Account WHERE ParentId = :acc.Id];
   * // ParentId is unused, but Id is used in the later SOQL
   * 
   * @param assignedVariable - Variable holding first SOQL results
   * @param laterSOQLs - Array of SOQL queries that come after
   * @param columns - Fields from the original SOQL
   * @returns Array of fields that are referenced in later SOQLs
   */
  public static findColumnsUsedInLaterSOQLs(
    assignedVariable: string,
    laterSOQLs: Array<{query: string; lineNumber: number}>,
    columns: string[]
  ): string[] {
    const usedColumns: string[] = [];

    for (const column of columns) {
      for (const laterSOQL of laterSOQLs) {
        const soqlQuery = laterSOQL.query;
        
        // Pattern to match: :varName.fieldName
        // This ensures we're finding actual bind variable usage, not just substring matches
        const bindVarPattern = new RegExp(
          `:${this.escapeRegex(assignedVariable)}\\.${this.escapeRegex(column)}\\b`,
          'i'
        );

        if (bindVarPattern.test(soqlQuery)) {
          usedColumns.push(column);
          break; // Found usage, no need to check other SOQLs for this field
        }
      }
    }

    return usedColumns;
  }

  /**
   * Analyze field usage patterns in code after SOQL
   * Identifies which specific fields are accessed via member notation
   * 
   * Tracks loop variables that iterate over the assigned variable
   * Example: List<Account> accounts = [...]; for (Account acc : accounts) { acc.Name }
   * We need to find fields accessed via both 'accounts' AND 'acc'
   * 
   * @param varName - Variable name holding SOQL results
   * @param codeAfterSOQL - Code text after the SOQL query
   * @param fields - Available fields from SOQL
   * @returns Array of fields that are explicitly accessed
   * 
   * @example
   * // Code: System.debug(acc.Name); System.debug(acc.Phone);
   * // Returns: ["Name", "Phone"]
   */
  public static findDirectFieldAccess(
    varName: string,
    codeAfterSOQL: string,
    fields: string[]
  ): string[] {
    const usedFields: string[] = [];

    // Find loop variables that iterate over this variable
    // Pattern: for (Type loopVar : varName)
    const loopVarPattern = new RegExp(
      `for\\s*\\(\\s*\\w+\\s+(\\w+)\\s*:\\s*${this.escapeRegex(varName)}\\s*\\)`,
      'gi'
    );
    const loopVarMatches = codeAfterSOQL.matchAll(loopVarPattern);
    const loopVars: string[] = [];
    for (const match of loopVarMatches) {
      loopVars.push(match[1]);
    }

    // Search for field access on the original variable AND all loop variables
    const varsToCheck = [varName, ...loopVars];
    
    for (const varToCheck of varsToCheck) {
      // Pattern to match variable.Field or variable[0].Field or variable.Relationship.Field
      // Handle relationship field access (e.g., con.Account.Name)
      // Exclude field assignments (var.Field = value) but ALLOW comparisons (var.Field == value)
      // (?!\\s*=[^=]) means: NOT followed by "=" unless it's "==" or "==="
      const memberAccessPattern = new RegExp(
        `\\b${this.escapeRegex(varToCheck)}(\\[\\d+\\])?\\.([a-zA-Z_][\\w.]*)(?!\\s*=[^=])`,
        'g'
      );

      const matches = codeAfterSOQL.matchAll(memberAccessPattern);

      for (const match of matches) {
        const accessedPath = match[2]; // The field path (e.g., "Name" or "Account.Name")
        
        // Check if this matches a SOQL field exactly (case-insensitive)
        const matchedField = fields.find(
          f => f.toLowerCase() === accessedPath.toLowerCase()
        );
        
        if (matchedField && !usedFields.includes(matchedField)) {
          usedFields.push(matchedField);
        }
      }
    }

    return usedFields;
  }

  /**
   * Escape special regex characters in variable names
   * Prevents regex injection and ensures accurate matching
   * 
   * @param str - String to escape
   * @returns Escaped string safe for use in regex
   */
  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Check if variable is used in a return statement
   * Simple pattern matching for return detection
   * 
   * @param varName - Variable name to check
   * @param methodCode - Method code to search
   * @returns true if variable is returned
   */
  public static isReturnedInCode(varName: string, methodCode: string): boolean {
    // Match: return var; or return var) or return var, but NOT return var.Field
    const returnPattern = new RegExp(
      `return\\s+${this.escapeRegex(varName)}\\s*[;,)]`,
      'i'
    );
    return returnPattern.test(methodCode);
  }
}
