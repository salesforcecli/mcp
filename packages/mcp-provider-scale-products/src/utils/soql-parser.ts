/**
 * SOQL Parser Utility
 * SOQL parsing logic for extracting and manipulating SOQL queries
 */

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



