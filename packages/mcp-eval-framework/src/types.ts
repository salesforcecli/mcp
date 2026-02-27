/**
 * Generic type definitions for the MCP Agent Evaluation Framework.
 * Domain-specific types live in the adapter (e.g. AntipatternDetectionScore).
 */

// ── Test Case Types ──

export interface TestCase {
  /** Unique identifier for this test case */
  id: string;
  /** Human-readable description */
  description: string;
  /** Fixture path relative to eval/fixtures/ */
  fixture: string;
  /** Prompt template — use {filePath} and {directory} as built-in placeholders */
  prompt: string;
  /** Expected results — shape is opaque to the framework; only the adapter knows it */
  expectedResults: Record<string, unknown>;
  /** Per-case scoring weight overrides */
  scoring: ScoringConfig;
  /** Domain-specific fields (e.g. className) pass through unchanged */
  [key: string]: unknown;
}

export interface ScoringConfig {
  factualAccuracy: DimensionConfig;
  completeness: DimensionConfig;
  toolEfficiency: ToolEfficiencyConfig;
  responseQuality: DimensionConfig;
}

export interface DimensionConfig {
  /** Weight for this dimension (0-1, all weights should sum to 1) */
  weight: number;
}

export interface ToolEfficiencyConfig extends DimensionConfig {
  /** Expected tool name to be invoked */
  expectedToolName?: string;
  /** Maximum acceptable number of tool calls */
  maxToolCalls?: number;
}

// ── CLI Invocation Types ──

export interface CliInvocationResult {
  /** Raw stdout from Claude CLI */
  stdout: string;
  /** Raw stderr from Claude CLI */
  stderr: string;
  /** Process exit code */
  exitCode: number | null;
  /** Wall-clock duration in milliseconds */
  durationMs: number;
}

export interface CliInvokerConfig {
  /** Model to use (default: sonnet) */
  model?: string;
  /** Timeout in milliseconds (default: 180000) */
  timeoutMs?: number;
  /** Working directory for the CLI */
  workingDirectory: string;
  /** Path to MCP config file (optional; omit to use user's Claude Code config) */
  mcpConfigPath?: string;
  /** --allowedTools glob for Claude CLI (e.g. "mcp__salesforce__*") */
  allowedToolsPattern: string;
}

// ── End-State Result (generic) ──

export interface DomainEndStateResult {
  /** Was the expected tool invoked? */
  toolSelected: boolean;
  /** Number of times the expected tool was called */
  toolCallCount: number;
  /** Was tool call count within the configured max? */
  toolCallCountWithinMax: boolean;
  /** Overall deterministic pass */
  pass: boolean;
  /** Domain-specific details — opaque to the framework, used by adapter.formatEndStateDetails() */
  details: Record<string, unknown>;
}

// ── Scoring Types ──

export interface JudgeScore {
  /** Factual accuracy score (1-5) */
  factualAccuracy: RubricResult;
  /** Completeness score (1-5) */
  completeness: RubricResult;
  /** Tool efficiency score (1-5) */
  toolEfficiency: RubricResult;
  /** Response quality score (1-5) */
  responseQuality: RubricResult;
  /** Weighted composite score (1-5) */
  compositeScore: number;
}

export interface RubricResult {
  /** Score from 1-5 */
  score: number;
  /** LLM justification for the score */
  justification: string;
}

// ── Case & Report Types ──

export interface CaseResult {
  /** Test case ID */
  testCaseId: string;
  /** Test case description */
  description: string;
  /** Fixture used */
  fixture: string;
  /** The prompt sent to Claude CLI (after placeholder substitution) */
  prompt: string;
  /** Raw CLI output */
  cliResult: CliInvocationResult;
  /** Deterministic scoring results */
  endStateScore: DomainEndStateResult;
  /** LLM-as-judge scoring results (null if --skip-judge) */
  judgeScore: JudgeScore | null;
  /** Final composite score (1-5) or deterministic pass score */
  finalScore: number;
  /** Pass/fail based on threshold */
  pass: boolean;
}

export interface EvalReport {
  /** Timestamp of the evaluation run */
  timestamp: string;
  /** Configuration used for this run */
  config: EvalRunConfig;
  /** Per-case results */
  results: CaseResult[];
  /** Summary statistics */
  summary: EvalSummary;
}

export interface EvalRunConfig {
  /** Model used for the agent under test */
  model: string;
  /** Model used for LLM-as-judge scoring */
  judgeModel?: string;
  /** Whether LLM judge was used */
  judgeEnabled: boolean;
  /** Pass/fail threshold (1-5) */
  passThreshold: number;
  /** Filter pattern if applied */
  filter?: string;
}

export interface EvalSummary {
  /** Total test cases run */
  totalCases: number;
  /** Number of passing cases */
  passedCases: number;
  /** Number of failing cases */
  failedCases: number;
  /** Overall pass rate (0-1) */
  passRate: number;
  /** Average final score across all cases */
  averageScore: number;
  /** Average scores per dimension (only when judge enabled) */
  averageByDimension: {
    factualAccuracy: number;
    completeness: number;
    toolEfficiency: number;
    responseQuality: number;
  } | null;
  /** Worst performing cases (up to 3) */
  worstCases: Array<{ testCaseId: string; score: number }>;
}

// ── Parsed Tool Call Types ──

export interface ParsedToolCall {
  /** Tool name that was called */
  toolName: string;
  /** Input parameters passed to the tool */
  input: Record<string, unknown>;
}

export interface ParsedAgentOutput {
  /** Final text response from the agent */
  responseText: string;
  /** Tool calls extracted from stream-json output */
  toolCalls: ParsedToolCall[];
}
