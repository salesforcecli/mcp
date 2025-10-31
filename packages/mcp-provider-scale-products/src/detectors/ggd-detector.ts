import { BaseDetector } from "./base-detector.js";
import { DetectedAntipattern } from "../models/detection-result.js";
import { AntipatternType } from "../models/antipattern-type.js";
import { Severity } from "../models/severity.js";

/**
 * Detector for Schema.getGlobalDescribe() antipattern
 * Uses regex-based static analysis to detect GGD invocations
 */
export class GGDDetector implements BaseDetector {
  // Regex pattern to detect Schema.getGlobalDescribe() calls
  // Matches variations like: Schema.getGlobalDescribe, schema.getGlobalDescribe
  private static readonly GGD_PATTERN = /([Ss])chema\s*\.\s*getGlobalDescribe\s*\(/;

  // Regex patterns to detect loop constructs
  private static readonly LOOP_PATTERNS = [
    /\bfor\s*\(/i,         // for loops
    /\bwhile\s*\(/i,       // while loops
    /\bdo\s*\{/i,          // do-while loops
  ];

  // Regex to detect method/function signatures
  private static readonly METHOD_SIGNATURE_PATTERN = 
    /(public|private|protected|global|static)?\s*(static)?\s+[\w<>,\s]+\s+\w+\s*\([^)]*\)\s*\{/i;

  public getAntipatternType(): AntipatternType {
    return AntipatternType.GGD;
  }

  public detect(className: string, apexCode: string): DetectedAntipattern[] {
    const detections: DetectedAntipattern[] = [];
    const lines = apexCode.split("\n");
    const codeWithoutComments = this.removeComments(apexCode);
    const linesWithoutComments = codeWithoutComments.split("\n");

    // Find all GGD invocations
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const originalLine = lines[lineIndex];
      const lineWithoutComments = linesWithoutComments[lineIndex];
      
      // Only check the line after removing comments
      if (GGDDetector.GGD_PATTERN.test(lineWithoutComments)) {
        const isInLoop = this.isLineInLoop(linesWithoutComments, lineIndex);
        const severity = isInLoop ? Severity.HIGH : Severity.MEDIUM;
        const methodName = this.extractMethodName(linesWithoutComments, lineIndex);

        detections.push({
          className,
          methodName,
          lineNumber: lineIndex + 1, // Convert to 1-indexed immediately
          codeBefore: originalLine.trim(),
          severity,
        });
      }
    }

    return detections;
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
   * Determines if a line is inside a loop construct
   * Scans backwards to find loop keywords before finding method signatures
   */
  private isLineInLoop(lines: string[], lineIndex: number): boolean {
    let openBraces = 0;
    let foundLoop = false;

    // Scan backwards from the detection line
    for (let i = lineIndex; i >= 0; i--) {
      const line = lines[i];

      // Count closing braces (going backwards, so these add to our scope depth)
      openBraces += (line.match(/\}/g) || []).length;
      // Count opening braces (going backwards, so these reduce our scope depth)
      openBraces -= (line.match(/\{/g) || []).length;

      // Check if we've found a loop keyword at the same or outer scope
      if (openBraces <= 0) {
        for (const loopPattern of GGDDetector.LOOP_PATTERNS) {
          if (loopPattern.test(line)) {
            foundLoop = true;
            break;
          }
        }
      }

      // Stop when we hit a method signature (we've left the method scope)
      if (GGDDetector.METHOD_SIGNATURE_PATTERN.test(line) && i !== lineIndex) {
        break;
      }

      if (foundLoop) break;
    }

    return foundLoop;
  }

  /**
   * Extracts the method name from context by scanning backwards
   */
  private extractMethodName(lines: string[], lineIndex: number): string | undefined {
    for (let i = lineIndex; i >= 0 && i > lineIndex - 50; i--) {
      const line = lines[i];
      const match = line.match(GGDDetector.METHOD_SIGNATURE_PATTERN);
      
      if (match) {
        // Extract method name from the signature
        const methodMatch = line.match(/\s(\w+)\s*\(/);
        return methodMatch ? methodMatch[1] : undefined;
      }
    }
    return undefined;
  }
}
