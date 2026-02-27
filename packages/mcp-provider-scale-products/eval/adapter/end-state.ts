import type {
  ParsedAgentOutput,
  ParsedToolCall,
  ToolEfficiencyConfig,
} from "@salesforce/mcp-eval-framework";

const SCAN_TOOL_NAME = "scan_apex_class_for_antipatterns";

// ── Antipattern-specific types ──

export interface ExpectedResults {
  antipatternCount: number;
  antipatterns: ExpectedAntipattern[];
  falsePositiveTypes: string[];
  noAntipatterns: boolean;
}

export interface ExpectedAntipattern {
  type: string;
  count: number;
  severity: string;
}

export interface EndStateScore {
  toolSelected: boolean;
  toolCallCount: number;
  toolCallCountWithinMax: boolean;
  antipatternDetection: AntipatternDetectionScore[];
  falsePositivesFound: boolean;
  cleanClassHandled: boolean | null;
  pass: boolean;
}

export interface AntipatternDetectionScore {
  type: string;
  detected: boolean;
  expectedCount: number;
  actualCount: number;
  countCorrect: boolean;
  severityCorrect: boolean;
}

/**
 * Deterministic end-state evaluator for the Apex antipattern domain.
 * Receives pre-parsed agent output and evaluates against expected results.
 * This layer is free (no API calls) and provides fast feedback.
 */
export class EndStateEvaluator {
  /**
   * Evaluates parsed agent output against expected antipattern results.
   *
   * @param parsed - Pre-parsed agent output (tool calls + response text)
   * @param rawOutput - Raw stdout for text-matching fallback
   * @param expected - Expected antipattern results from the test case
   * @param toolConfig - Tool efficiency config (maxToolCalls etc.)
   */
  evaluate(
    parsed: ParsedAgentOutput,
    rawOutput: string,
    expected: ExpectedResults,
    toolConfig: ToolEfficiencyConfig
  ): EndStateScore {
    const toolSelected = this.checkToolSelected(parsed.toolCalls);
    const toolCallCount = this.countToolCalls(parsed.toolCalls, SCAN_TOOL_NAME);
    const maxCalls = toolConfig.maxToolCalls ?? 2;
    const toolCallCountWithinMax = toolCallCount <= maxCalls;

    const antipatternDetection = this.checkAntipatternDetection(
      parsed.responseText,
      rawOutput,
      expected
    );

    const falsePositivesFound = this.checkFalsePositives(
      parsed.responseText,
      rawOutput,
      expected.falsePositiveTypes
    );

    let cleanClassHandled: boolean | null = null;
    if (expected.noAntipatterns) {
      cleanClassHandled = this.checkCleanClass(parsed.responseText, rawOutput);
    }

    const allDetectionsCorrect = antipatternDetection.every(
      (d) => d.detected && d.countCorrect
    );

    const pass =
      toolSelected &&
      toolCallCountWithinMax &&
      allDetectionsCorrect &&
      !falsePositivesFound &&
      (cleanClassHandled === null || cleanClassHandled);

    return {
      toolSelected,
      toolCallCount,
      toolCallCountWithinMax,
      antipatternDetection,
      falsePositivesFound,
      cleanClassHandled,
      pass,
    };
  }

  private checkToolSelected(toolCalls: ParsedToolCall[]): boolean {
    return toolCalls.some((tc) => tc.toolName.includes(SCAN_TOOL_NAME));
  }

  private countToolCalls(toolCalls: ParsedToolCall[], toolName: string): number {
    return toolCalls.filter((tc) => tc.toolName.includes(toolName)).length;
  }

  private checkAntipatternDetection(
    responseText: string,
    rawOutput: string,
    expected: ExpectedResults
  ): AntipatternDetectionScore[] {
    if (expected.noAntipatterns) {
      return [];
    }

    const combinedText = responseText + "\n" + rawOutput;

    return expected.antipatterns.map((exp) => {
      const detected = this.isAntipatternTypePresent(combinedText, exp.type);
      const actualCount = this.countAntipatternInstances(combinedText, exp.type);
      const severityCorrect = this.isSeverityPresent(combinedText, exp.severity);

      return {
        type: exp.type,
        detected,
        expectedCount: exp.count,
        actualCount,
        countCorrect: actualCount >= exp.count,
        severityCorrect,
      };
    });
  }

  private isAntipatternTypePresent(text: string, type: string): boolean {
    const patterns = [
      type,
      type.toLowerCase(),
      type.replace(/_/g, " "),
    ];

    const friendlyNames: Record<string, string[]> = {
      GGD: ["getGlobalDescribe", "Schema.getGlobalDescribe", "global describe"],
      SOQL_NO_WHERE_LIMIT: [
        "SOQL",
        "no WHERE",
        "no LIMIT",
        "missing WHERE",
        "missing LIMIT",
        "without WHERE",
        "without LIMIT",
      ],
      SOQL_UNUSED_FIELDS: [
        "unused field",
        "unused fields",
        "SOQL_UNUSED_FIELDS",
      ],
    };

    const allPatterns = [...patterns, ...(friendlyNames[type] ?? [])];
    return allPatterns.some((p) => text.includes(p));
  }

  private countAntipatternInstances(text: string, type: string): number {
    // Strategy 1: Find structured JSON in fenced code blocks
    const jsonBlocks = text.match(/```json\n([\s\S]*?)\n```/g);
    if (jsonBlocks) {
      for (const block of jsonBlocks) {
        const jsonStr = block.replace(/```json\n/, "").replace(/\n```/, "");
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.antipatternResults) {
            const matching = parsed.antipatternResults.find(
              (r: { antipatternType: string }) => r.antipatternType === type
            );
            if (matching?.detectedInstances) {
              return matching.detectedInstances.length;
            }
          }
        } catch {
          // JSON parse failed, continue
        }
      }
    }

    // Strategy 2: Extract antipatternResults JSON from raw text
    const antipatternResultsMatch = text.match(
      /"antipatternResults"\s*:\s*\[([\s\S]*?)\]\s*\}/
    );
    if (antipatternResultsMatch) {
      try {
        const parsed = JSON.parse(`{"antipatternResults":[${antipatternResultsMatch[1]}]}`);
        if (parsed.antipatternResults) {
          const matching = parsed.antipatternResults.find(
            (r: { antipatternType: string }) => r.antipatternType === type
          );
          if (matching?.detectedInstances) {
            return matching.detectedInstances.length;
          }
        }
      } catch {
        // Continue to fallback
      }
    }

    // Strategy 3: Count "antipatternType": "TYPE" occurrences
    const regex = new RegExp(`"antipatternType"\\s*:\\s*"${type}"`, "g");
    const escapedRegex = new RegExp(`\\\\"antipatternType\\\\"\\s*:\\s*\\\\"${type}\\\\"`, "g");
    const matches = text.match(regex);
    const escapedMatches = text.match(escapedRegex);

    if (matches && matches.length > 0) return matches.length;
    if (escapedMatches && escapedMatches.length > 0) return escapedMatches.length;

    // Strategy 4: Count textual references
    const countPatterns = [
      new RegExp(`Found\\s+(\\d+)\\s+issue`, "i"),
      new RegExp(`(\\d+)\\s+instance`, "i"),
      new RegExp(`(\\d+)\\s+antipattern`, "i"),
    ];
    for (const pattern of countPatterns) {
      const match = text.match(pattern);
      if (match) {
        const count = parseInt(match[1], 10);
        if (count > 0) return count;
      }
    }

    return 0;
  }

  private isSeverityPresent(text: string, severity: string): boolean {
    return text.toLowerCase().includes(severity.toLowerCase());
  }

  private checkFalsePositives(
    responseText: string,
    rawOutput: string,
    falsePositiveTypes: string[]
  ): boolean {
    if (falsePositiveTypes.length === 0) return false;

    const combinedText = responseText + "\n" + rawOutput;

    // Look for false positives in structured JSON only (not general text)
    const jsonBlocks = combinedText.match(/```json\n([\s\S]*?)\n```/g);
    if (!jsonBlocks) return false;

    for (const block of jsonBlocks) {
      const jsonStr = block.replace(/```json\n/, "").replace(/\n```/, "");
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.antipatternResults) {
          for (const fpType of falsePositiveTypes) {
            const found = parsed.antipatternResults.some(
              (r: { antipatternType: string }) => r.antipatternType === fpType
            );
            if (found) return true;
          }
        }
      } catch {
        // Continue
      }
    }

    return false;
  }

  private checkCleanClass(responseText: string, rawOutput: string): boolean {
    const combinedText = (responseText + "\n" + rawOutput).toLowerCase();
    const cleanIndicators = [
      "no antipatterns",
      "no issues",
      "clean",
      "no antipattern",
      "no performance issues",
      "0 issue",
      "no problems",
    ];
    return cleanIndicators.some((indicator) => combinedText.includes(indicator));
  }
}
