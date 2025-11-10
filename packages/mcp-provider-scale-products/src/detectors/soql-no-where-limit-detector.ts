import { BaseDetector } from "./base-detector.js";
import { DetectedAntipattern } from "../models/detection-result.js";
import { AntipatternType } from "../models/antipattern-type.js";
import { Severity } from "../models/severity.js";

/**
 * Detector for SOQL queries without WHERE or LIMIT clauses
 * Uses regex-based static analysis to detect problematic SOQL queries
 */
export class SOQLNoWhereLimitDetector implements BaseDetector {
  // Pattern to find SELECT keyword (matches Python's r'(\W|^)select(\W|$)')
  private static readonly SELECT_PATTERN = /(\W|^)select(\W|$)/i;

  // Pattern to find [SELECT (for backward search)
  private static readonly BRACKET_SELECT_PATTERN = /\[\s*select(\W|$)/i;

  // Regex to detect method/function signatures
  private static readonly METHOD_SIGNATURE_PATTERN = 
    /(public|private|protected|global|static)?\s*(static)?\s+[\w<>,\s]+\s+\w+\s*\([^)]*\)\s*\{/i;

  public getAntipatternType(): AntipatternType {
    return AntipatternType.SOQL_NO_WHERE_LIMIT;
  }

  public detect(className: string, apexCode: string): DetectedAntipattern[] {
    const detections: DetectedAntipattern[] = [];
    const lines = apexCode.split("\n");
    const codeWithoutComments = this.removeComments(apexCode);
    const linesWithoutComments = codeWithoutComments.split("\n");
    
    // Track processed query ranges to avoid duplicates
    const processedRanges = new Set<string>();

    // Find all SOQL queries (Python-equivalent logic)
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const lineWithoutComments = linesWithoutComments[lineIndex];
      
      // Step 1: Find lines with SELECT keyword (like Python)
      if (SOQLNoWhereLimitDetector.SELECT_PATTERN.test(lineWithoutComments)) {
        
        // Step 2: Find where the [ bracket is (look backwards up to 5 lines)
        const bracketLineIndex = this.findBracketLine(linesWithoutComments, lineIndex);
        
        if (bracketLineIndex !== -1) {
          // Check if we already processed this query
          const queryKey = `${bracketLineIndex}`;
          if (processedRanges.has(queryKey)) {
            continue; // Skip duplicates (nested queries)
          }
          
          // Step 3: Extract the full SOQL query starting from bracket line
          const soqlQuery = this.extractSOQLQuery(linesWithoutComments, bracketLineIndex);
          
          if (soqlQuery && this.detectNoWhereLimitInSOQL(soqlQuery.query)) {
            const methodName = this.extractMethodName(linesWithoutComments, bracketLineIndex);
            const originalLine = lines[bracketLineIndex];

            detections.push({
              className,
              methodName,
              lineNumber: bracketLineIndex + 1, // Report line where [ is found
              codeBefore: originalLine.trim(),
              severity: Severity.HIGH,
            });
            
            // Mark this query range as processed
            processedRanges.add(queryKey);
            
            // Also mark the end line to avoid detecting nested queries
            for (let i = bracketLineIndex; i <= soqlQuery.endLine; i++) {
              processedRanges.add(`${i}`);
            }
          }
        }
      }
    }

    return detections;
  }

  /**
   * Finds the line index where [ bracket starts for a SOQL query
   * Looks backwards up to 5 lines from the SELECT keyword (matches Python logic)
   * 
   * @param lines - Lines of code without comments
   * @param selectLineIndex - Index of line containing SELECT keyword
   * @returns Line index where [ is found, or -1 if not found
   */
  private findBracketLine(lines: string[], selectLineIndex: number): number {
    const currentLine = lines[selectLineIndex];
    
    // Check if [SELECT is on the same line
    if (SOQLNoWhereLimitDetector.BRACKET_SELECT_PATTERN.test(currentLine)) {
      return selectLineIndex;
    }
    
    // Look backwards up to 5 lines (Python: for i in range(idx - 1, -1, -1): if idx - i > 5: break)
    const lookBackLimit = 5;
    for (let i = selectLineIndex - 1; i >= 0 && selectLineIndex - i <= lookBackLimit; i--) {
      // Join lines from i to selectLineIndex (inclusive)
      const multiLineContext = lines.slice(i, selectLineIndex + 1).join('\n');
      
      // Check if this range contains [SELECT
      if (SOQLNoWhereLimitDetector.BRACKET_SELECT_PATTERN.test(multiLineContext)) {
        return i; // Return the line where [ was found
      }
    }
    
    return -1; // Not found within 5 lines
  }

  /**
   * Detects if a SOQL query lacks WHERE or LIMIT clauses
   * Handles both simple and nested SOQL queries
   */
  private detectNoWhereLimitInSOQL(soqlLine: string): boolean {
    // Search for 'where' or 'limit' in the SOQL line
    let hasWhereLimitClause = /(\W|^)(where|limit)(\W|$)/i.test(soqlLine);
    
    if (!hasWhereLimitClause) {
      // If not even one where/limit is found, return true (antipattern detected)
      return true;
    }
    
    // Find all SELECT statements to determine if it's a nested query
    const selectMatches = soqlLine.match(/\Wselect\s/gi) || [];
    
    if (selectMatches.length === 1) {
      // If single SOQL with where/limit found, no antipattern
      return false;
    }
    
    // Here it means it's nested SOQL
    // Remove subqueries using nested SELECT regex and find where/limit in the outermost SOQL
    const cleanedSoql = soqlLine.replace(/\(\s*select\s+[\s\S]*?\)/gi, '');
    hasWhereLimitClause = /(\W|^)(where|limit)(\W|$)/i.test(cleanedSoql);
    
    // Return true if where/limit not found in outermost query
    return !hasWhereLimitClause;
  }

  /**
   * Extracts the full SOQL query from the code, handling multi-line queries
   */
  private extractSOQLQuery(lines: string[], startLineIndex: number): { query: string; endLine: number } | null {
    let soqlQuery = "";
    let openBrackets = 0;
    let foundStart = false;

    for (let i = startLineIndex; i < lines.length; i++) {
      const line = lines[i];
      
      for (const char of line) {
        if (char === '[') {
          if (!foundStart) foundStart = true;
          openBrackets++;
        } else if (char === ']') {
          openBrackets--;
        }
        
        if (foundStart) {
          soqlQuery += char;
        }
        
        // Complete SOQL query found
        if (foundStart && openBrackets === 0) {
          return { query: soqlQuery, endLine: i };
        }
      }
      
      if (foundStart) {
        soqlQuery += "\n";
      }
    }
    
    // If we reach here, SOQL query might be incomplete or malformed
    return soqlQuery ? { query: soqlQuery, endLine: lines.length - 1 } : null;
  }

  /**
   * Removes comments and string literals from Apex code
   * while preserving line numbers for accurate detection.
   * Handles single-line comments, block comments, and string literals.
   */
  private removeComments(code: string): string {
    let result = '';
    let inBlockComment = false;
    let inSingleQuoteString = false;
    let inDoubleQuoteString = false;
    let i = 0;

    while (i < code.length) {
      const currentChar = code[i];
      const nextChar = i < code.length - 1 ? code[i + 1] : '';
      
      // Handle string literals (not in comments)
      if (!inBlockComment) {
        // Check for single quote string start/end
        if (currentChar === "'" && !inDoubleQuoteString) {
          // Check if escaped
          const isEscaped = i > 0 && code[i - 1] === '\\';
          if (!isEscaped) {
            inSingleQuoteString = !inSingleQuoteString;
            result += ' '; // Replace string delimiter with space
            i++;
            continue;
          }
        }
        
        // Check for double quote string start/end
        if (currentChar === '"' && !inSingleQuoteString) {
          // Check if escaped
          const isEscaped = i > 0 && code[i - 1] === '\\';
          if (!isEscaped) {
            inDoubleQuoteString = !inDoubleQuoteString;
            result += ' '; // Replace string delimiter with space
            i++;
            continue;
          }
        }
        
        // If inside string, replace with space (preserve newlines)
        if (inSingleQuoteString || inDoubleQuoteString) {
          result += currentChar === '\n' ? '\n' : ' ';
          i++;
          continue;
        }
      }

      // Check for block comment start (not in strings)
      if (!inBlockComment && !inSingleQuoteString && !inDoubleQuoteString && 
          currentChar === '/' && nextChar === '*') {
        inBlockComment = true;
        result += '  '; // Preserve spacing
        i += 2;
        continue;
      }

      // Check for block comment end
      if (inBlockComment && currentChar === '*' && nextChar === '/') {
        inBlockComment = false;
        result += '  '; // Preserve spacing
        i += 2;
        continue;
      }

      // Check for single-line comment start (not in strings)
      if (!inBlockComment && !inSingleQuoteString && !inDoubleQuoteString && 
          currentChar === '/' && nextChar === '/') {
        // Skip until end of line
        while (i < code.length && code[i] !== '\n') {
          result += code[i] === '\n' ? '\n' : ' '; // Preserve newlines
          i++;
        }
        continue;
      }

      // If in block comment, replace with space
      if (inBlockComment) {
        result += currentChar === '\n' ? '\n' : ' ';
      } else {
        result += currentChar;
      }
      i++;
    }

    return result;
  }

  /**
   * Extracts the method name from context by scanning backwards
   */
  private extractMethodName(lines: string[], lineIndex: number): string | undefined {
    for (let i = lineIndex; i >= 0 && i > lineIndex - 50; i--) {
      const line = lines[i];
      const match = line.match(SOQLNoWhereLimitDetector.METHOD_SIGNATURE_PATTERN);
      
      if (match) {
        // Extract method name from the signature
        const methodMatch = line.match(/\s(\w+)\s*\(/);
        return methodMatch ? methodMatch[1] : undefined;
      }
    }
    return undefined;
  }
}
