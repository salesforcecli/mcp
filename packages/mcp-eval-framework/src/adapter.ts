import type {
  TestCase,
  ParsedAgentOutput,
  ToolEfficiencyConfig,
  DomainEndStateResult,
} from "./types.js";

/**
 * A rubric function takes the agent's prompt, output, and ground truth,
 * and returns a prompt string for the LLM judge to score one dimension.
 * The returned string should instruct the judge to output JSON: { "score": 1-5, "justification": "..." }
 */
export type RubricFn = (
  prompt: string,
  agentOutput: string,
  groundTruth: string
) => string;

/**
 * EvalAdapter — the single extension point for domain-specific behavior.
 *
 * Each MCP provider implements this interface once.
 * The framework calls these methods at the right times during the eval run.
 */
export interface EvalAdapter {
  /**
   * The MCP tool name the agent should invoke.
   * Used by evaluateEndState() to check tool selection.
   * e.g. "scan_apex_class_for_antipatterns"
   */
  toolName: string;

  /**
   * Claude CLI --allowedTools glob that auto-approves MCP tools.
   * e.g. "mcp__salesforce__*,mcp__salesforce-dx__*"
   */
  allowedToolsPattern: string;

  /**
   * Returns additional {placeholder} substitutions for the prompt template,
   * beyond the built-ins {filePath} and {directory}.
   *
   * Example: return { apexFilePath: filePath } for backward compat with
   * existing YAML test cases that use {apexFilePath}.
   */
  resolvePromptPlaceholders(
    testCase: TestCase,
    filePath: string,
    directory: string
  ): Record<string, string>;

  /**
   * Deterministic scoring: did the agent get the right answer?
   * Called after the agent run completes.
   *
   * @param output - Parsed agent output (tool calls + response text)
   * @param rawOutput - Raw stdout string (for text-matching fallback)
   * @param expected - The expectedResults from the test case (your domain shape)
   * @param config - toolEfficiency config from the test case scoring section
   */
  evaluateEndState(
    output: ParsedAgentOutput,
    rawOutput: string,
    expected: Record<string, unknown>,
    config: ToolEfficiencyConfig
  ): DomainEndStateResult;

  /**
   * Converts expectedResults to a natural language ground truth string.
   * Used by the LLM judge to understand what the correct answer looks like.
   */
  formatGroundTruth(expected: Record<string, unknown>): string;

  /**
   * Returns lines to display per test case in the terminal (domain-specific).
   * Called both during the run (inline progress) and in the final report.
   *
   * Example return value:
   *   ["FP: none", "GGD: ✔ found 1/1  severity: ok"]
   */
  formatEndStateDetails(result: DomainEndStateResult): string[];

  /**
   * Four rubric functions for LLM-as-judge scoring.
   * Each returns a prompt string for the judge to score one dimension.
   */
  rubrics: {
    factualAccuracy: RubricFn;
    completeness: RubricFn;
    toolEfficiency: RubricFn;
    responseQuality: RubricFn;
  };
}
