/**
 * @salesforce/mcp-eval-framework
 *
 * Generic MCP agent evaluation framework.
 * Implement EvalAdapter to plug in your domain-specific tool, test cases, and scoring logic.
 *
 * Quick start:
 *   1. Add this package as a devDependency
 *   2. Implement EvalAdapter in eval/adapter/index.ts
 *   3. Write test cases in eval/test-cases/*.yaml
 *   4. Create eval/run-eval.ts using the boilerplate below
 *
 * @see ONBOARDING.md for the full guide
 */

// Core extension point
export type { EvalAdapter, RubricFn } from "./adapter.js";

// Generic types
export type {
  TestCase,
  ScoringConfig,
  DimensionConfig,
  ToolEfficiencyConfig,
  CliInvocationResult,
  CliInvokerConfig,
  DomainEndStateResult,
  JudgeScore,
  RubricResult,
  CaseResult,
  EvalReport,
  EvalRunConfig,
  EvalSummary,
  ParsedToolCall,
  ParsedAgentOutput,
} from "./types.js";

// Runner
export { EvalRunner } from "./runner/eval-runner.js";
export type { EvalRunnerOptions } from "./runner/eval-runner.js";
export { FixtureManager } from "./runner/fixture-manager.js";
export { ClaudeCliInvoker } from "./runner/claude-cli-invoker.js";

// Scoring
export { JudgeEvaluator } from "./scoring/judge-evaluator.js";

// Reporting
export { ConsoleReporter } from "./reporting/console-reporter.js";
export { JsonReporter } from "./reporting/json-reporter.js";
