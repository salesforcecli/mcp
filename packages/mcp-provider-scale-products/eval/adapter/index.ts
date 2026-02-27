import chalk from "chalk";
import type {
  EvalAdapter,
  TestCase,
  ParsedAgentOutput,
  ToolEfficiencyConfig,
  DomainEndStateResult,
} from "@salesforce/mcp-eval-framework";
import { EndStateEvaluator } from "./end-state.js";
import type { ExpectedResults } from "./end-state.js";
import { factualAccuracyRubric } from "./rubrics/factual-accuracy.js";
import { completenessRubric } from "./rubrics/completeness.js";
import { toolEfficiencyRubric } from "./rubrics/tool-efficiency.js";
import { responseQualityRubric } from "./rubrics/response-quality.js";

const endStateEvaluator = new EndStateEvaluator();

/**
 * EvalAdapter implementation for the Apex antipattern scan tool.
 * Wires together deterministic end-state scoring, ground truth formatting,
 * and LLM-as-judge rubrics for the scale-products domain.
 */
export const apexAntipatternAdapter: EvalAdapter = {
  toolName: "scan_apex_class_for_antipatterns",
  allowedToolsPattern: "mcp__salesforce__*,mcp__salesforce-dx__*",

  /**
   * Maps {apexFilePath} → filePath for backward compatibility with existing
   * YAML test cases that use {apexFilePath} as the prompt placeholder.
   */
  resolvePromptPlaceholders(
    _testCase: TestCase,
    filePath: string,
    _directory: string
  ): Record<string, string> {
    return { apexFilePath: filePath };
  },

  evaluateEndState(
    output: ParsedAgentOutput,
    rawOutput: string,
    expected: Record<string, unknown>,
    config: ToolEfficiencyConfig
  ): DomainEndStateResult {
    const score = endStateEvaluator.evaluate(
      output,
      rawOutput,
      expected as unknown as ExpectedResults,
      config
    );
    return {
      toolSelected: score.toolSelected,
      toolCallCount: score.toolCallCount,
      toolCallCountWithinMax: score.toolCallCountWithinMax,
      pass: score.pass,
      details: {
        antipatternDetection: score.antipatternDetection,
        falsePositivesFound: score.falsePositivesFound,
        cleanClassHandled: score.cleanClassHandled,
      },
    };
  },

  formatGroundTruth(expected: Record<string, unknown>): string {
    const exp = expected as unknown as ExpectedResults;
    if (exp.noAntipatterns) {
      return "This is a CLEAN class with NO antipatterns. The agent should report that no issues were found.";
    }

    const lines = [
      `Expected ${exp.antipatternCount} total antipattern instance(s):`,
    ];
    for (const ap of exp.antipatterns) {
      lines.push(
        `  - ${ap.type}: ${ap.count} instance(s), severity: ${ap.severity}`
      );
    }
    if (exp.falsePositiveTypes.length > 0) {
      lines.push(
        `False positive types that should NOT appear: ${exp.falsePositiveTypes.join(", ")}`
      );
    }
    return lines.join("\n");
  },

  formatEndStateDetails(result: DomainEndStateResult): string[] {
    const lines: string[] = [];
    const d = result.details;

    // False positives
    const fpStr = d.falsePositivesFound ? chalk.red("yes") : chalk.green("none");
    lines.push(`FP: ${fpStr}`);

    // Antipattern detection breakdown
    if (Array.isArray(d.antipatternDetection) && d.antipatternDetection.length > 0) {
      for (const ad of d.antipatternDetection as Array<{
        type: string;
        detected: boolean;
        actualCount: number;
        expectedCount: number;
        countCorrect: boolean;
        severityCorrect: boolean;
      }>) {
        const detIcon = ad.detected ? chalk.green("found") : chalk.red("missed");
        const countIcon = ad.countCorrect
          ? chalk.green(`${ad.actualCount}/${ad.expectedCount}`)
          : chalk.red(`${ad.actualCount}/${ad.expectedCount}`);
        const sevIcon = ad.severityCorrect ? chalk.green("ok") : chalk.yellow("mismatch");
        lines.push(`${ad.type}: ${detIcon}  count: ${countIcon}  severity: ${sevIcon}`);
      }
    }

    // Clean class result
    if (d.cleanClassHandled !== null && d.cleanClassHandled !== undefined) {
      const cleanIcon = d.cleanClassHandled
        ? chalk.green("correctly identified")
        : chalk.red("not identified");
      lines.push(`Clean class: ${cleanIcon}`);
    }

    return lines;
  },

  rubrics: {
    factualAccuracy: factualAccuracyRubric,
    completeness: completenessRubric,
    toolEfficiency: toolEfficiencyRubric,
    responseQuality: responseQualityRubric,
  },
};
