/**
 * SOQL Field Tracker Utility
 * Sophisticated field usage analysis logic
 */

/**
 * Tracks SOQL field usage patterns to determine which fields are actually used
 * Implements check_if_soql_results_are_used and find_columns_used_in_soqls logic
 */
export class SOQLFieldTracker {
  /**
   * Check if complete SOQL results are used (not individual fields)
   * 
   * This is CRITICAL for avoiding false positives. When the complete SOQL result
   * is passed around or returned, we cannot safely optimize it.
   * 
   * CRITICAL patterns:
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

    // Remove special method calls that don't indicate complete usage
    let cleanedCode = codeNoComment
      .replace(new RegExp(`${this.escapeRegex(varName)}\\.isEmpty\\(\\)`, 'g'), '')
      .replace(new RegExp(`${this.escapeRegex(varName)}\\s*!=\\s*null`, 'g'), '')
      .replace(new RegExp(`${this.escapeRegex(varName)}\\.size\\(\\)`, 'g'), '')
      // CRITICAL: Remove for-each loops - iterating over collection is NOT complete usage
      .replace(new RegExp(`for\\s*\\([^:]*:\\s*${this.escapeRegex(varName)}\\s*\\)`, 'gi'), '')
      // EDGE CASE FIX: Remove DML statements - they only need Id field, not complete usage
      .replace(new RegExp(`(delete|update|insert|upsert)\\s+${this.escapeRegex(varName)}\\s*;`, 'gi'), '');

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
        const soqlQuery = laterSOQL.query.toLowerCase();
        const varLower = assignedVariable.toLowerCase();
        const colLower = column.toLowerCase();

        // Check if both variable and column appear in later SOQL
        // Example: WHERE AccountId = :acc.Id
        if (soqlQuery.includes(varLower) && soqlQuery.includes(colLower)) {
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
   * CRITICAL FIX: Also tracks loop variables that iterate over the assigned variable
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

    // CRITICAL: Find loop variables that iterate over this variable
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
      // CRITICAL FIX: Handle relationship field access (e.g., con.Account.Name)
      // EDGE CASE FIX: Exclude field assignments (var.Field = value) but ALLOW comparisons (var.Field == value)
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
    const returnPattern = new RegExp(
      `return\\s+${this.escapeRegex(varName)}\\b`,
      'i'
    );
    return returnPattern.test(methodCode);
  }
}


