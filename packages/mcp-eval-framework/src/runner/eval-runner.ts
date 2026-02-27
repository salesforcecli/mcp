import * as path from "node:path";
import chalk from "chalk";
import type {
  TestCase,
  CaseResult,
  EvalReport,
  EvalRunConfig,
  EvalSummary,
  CliInvokerConfig,
  JudgeScore,
  ParsedAgentOutput,
  ParsedToolCall,
} from "../types.js";
import type { EvalAdapter } from "../adapter.js";
import { FixtureManager } from "./fixture-manager.js";
import { ClaudeCliInvoker } from "./claude-cli-invoker.js";
import { JudgeEvaluator } from "../scoring/judge-evaluator.js";

const PASS_THRESHOLD = 3.5;

export interface EvalRunnerOptions {
  /** Model to use for Claude CLI invocation (agent under test) */
  model?: string;
  /** Model to use for LLM-as-judge scoring (default: sonnet) */
  judgeModel?: string;
  /** Skip LLM-as-judge scoring (deterministic only) */
  skipJudge?: boolean;
  /** Filter test cases by ID pattern */
  filter?: string;
  /** Pass/fail threshold (1-5) */
  passThreshold?: number;
  /** Explicit MCP config path (omit to use user's Claude Code config) */
  mcpConfigPath?: string;
  /**
   * Called immediately after each test case completes.
   * Use this to flush partial results to disk so progress isn't lost if the run is interrupted.
   */
  onCaseComplete?: (result: CaseResult, completedIndex: number, totalCases: number) => void;
}

/**
 * Orchestrates the evaluation run: invokes Claude CLI for each test case,
 * scores results via the adapter, and produces an EvalReport.
 */
export class EvalRunner {
  private readonly evalDir: string;
  private readonly adapter: EvalAdapter;
  private readonly fixtureManager: FixtureManager;
  private readonly options: EvalRunnerOptions;

  constructor(evalDir: string, adapter: EvalAdapter, options: EvalRunnerOptions = {}) {
    this.evalDir = evalDir;
    this.adapter = adapter;
    this.fixtureManager = new FixtureManager(path.join(evalDir, "fixtures"));
    this.options = options;
  }

  /**
   * Runs the evaluation for a set of test cases and produces a report.
   */
  async run(testCases: TestCase[]): Promise<EvalReport> {
    const threshold = this.options.passThreshold ?? PASS_THRESHOLD;

    // Filter test cases if pattern provided
    let filteredCases = testCases;
    if (this.options.filter) {
      const pattern = this.options.filter.toLowerCase();
      filteredCases = testCases.filter(
        (tc) =>
          tc.id.toLowerCase().includes(pattern) ||
          tc.description.toLowerCase().includes(pattern)
      );
    }

    const results: CaseResult[] = [];
    const mcpConfigPath = this.options.mcpConfigPath;

    // Initialize judge if needed
    let judgeEvaluator: JudgeEvaluator | null = null;
    if (!this.options.skipJudge) {
      judgeEvaluator = new JudgeEvaluator(this.options.judgeModel);
    }

    const startTime = Date.now();

    for (let i = 0; i < filteredCases.length; i++) {
      const testCase = filteredCases[i];
      const counter = chalk.dim(`[${i + 1}/${filteredCases.length}]`);

      console.log("");
      console.log(`${counter} ${chalk.bold(testCase.id)}`);
      console.log(chalk.dim(`       ${testCase.description}`));
      console.log(chalk.dim(`       Prompt: "${this.truncate(testCase.prompt, 70)}"`));

      const result = await this.runCase(
        testCase,
        mcpConfigPath,
        judgeEvaluator,
        threshold
      );

      // Result line
      const icon = result.pass ? chalk.green("✔ PASS") : chalk.red("✘ FAIL");
      const score = result.finalScore.toFixed(2);
      const duration = this.formatDuration(result.cliResult.durationMs);
      console.log(`       ${icon}  ${chalk.bold(score)}/5.0  ${chalk.dim(duration)}`);

      // Generic deterministic summary
      const es = result.endStateScore;
      const toolIcon = es.toolSelected ? chalk.green("✔") : chalk.red("✘");
      const callsStr = es.toolCallCountWithinMax
        ? chalk.green(String(es.toolCallCount))
        : chalk.red(`${es.toolCallCount} (over max)`);
      console.log(chalk.dim(`       Tool: ${toolIcon}  Calls: ${callsStr}`));

      // Domain-specific details from adapter
      const details = this.adapter.formatEndStateDetails(es);
      for (const line of details) {
        console.log(chalk.dim(`       ${line}`));
      }

      results.push(result);

      // Notify caller so they can flush partial results to disk
      this.options.onCaseComplete?.(result, results.length, filteredCases.length);
    }

    const totalDuration = Date.now() - startTime;
    console.log("");
    console.log(chalk.dim(`Completed ${filteredCases.length} cases in ${this.formatDuration(totalDuration)}`));
    console.log("");

    const config: EvalRunConfig = {
      model: this.options.model ?? "sonnet",
      judgeModel: this.options.judgeModel,
      judgeEnabled: !this.options.skipJudge,
      passThreshold: threshold,
      filter: this.options.filter,
    };

    const summary = this.computeSummary(results, !this.options.skipJudge);

    return {
      timestamp: new Date().toISOString(),
      config,
      results,
      summary,
    };
  }

  /**
   * Runs a single test case: fixture setup, CLI invocation, scoring.
   */
  private async runCase(
    testCase: TestCase,
    mcpConfigPath: string | undefined,
    judgeEvaluator: JudgeEvaluator | null,
    threshold: number
  ): Promise<CaseResult> {
    this.fixtureManager.init();
    try {
      const { filePath, directory } = this.fixtureManager.prepare(testCase.fixture);

      // Built-in placeholder substitutions
      let prompt = testCase.prompt
        .replace(/\{filePath\}/g, filePath)
        .replace(/\{directory\}/g, directory);

      // Adapter-provided placeholder substitutions (e.g. {apexFilePath} for backward compat)
      const extraPlaceholders = this.adapter.resolvePromptPlaceholders(testCase, filePath, directory);
      for (const [key, value] of Object.entries(extraPlaceholders)) {
        prompt = prompt.replace(new RegExp(`\\{${key}\\}`, "g"), value);
      }

      // Invoke Claude CLI
      const invokerConfig: CliInvokerConfig = {
        model: this.options.model,
        workingDirectory: directory,
        mcpConfigPath,
        allowedToolsPattern: this.adapter.allowedToolsPattern,
      };
      const invoker = new ClaudeCliInvoker(invokerConfig);
      const spinner = this.createProgressIndicator();
      spinner.update("Agent running");
      const cliResult = await invoker.invoke(prompt);
      spinner.update(`Scoring (agent took ${this.formatDuration(cliResult.durationMs)})`);

      // Parse stream-json output
      const parsed = this.parseOutput(cliResult.stdout);

      // Run deterministic scoring via adapter
      const endStateScore = this.adapter.evaluateEndState(
        parsed,
        cliResult.stdout,
        testCase.expectedResults,
        testCase.scoring.toolEfficiency
      );

      // Run LLM-as-judge scoring (if enabled)
      let judgeScore: JudgeScore | null = null;
      if (judgeEvaluator) {
        spinner.update("LLM judge scoring");
        const groundTruth = this.adapter.formatGroundTruth(testCase.expectedResults);
        judgeScore = await judgeEvaluator.evaluate(
          prompt,
          cliResult.stdout,
          groundTruth,
          this.adapter.rubrics,
          testCase.scoring
        );
      }

      spinner.stop();

      // Calculate final score
      const finalScore = judgeScore
        ? judgeScore.compositeScore
        : endStateScore.pass
          ? 5.0
          : 1.0;

      return {
        testCaseId: testCase.id,
        description: testCase.description,
        fixture: testCase.fixture,
        prompt,
        cliResult,
        endStateScore,
        judgeScore,
        finalScore,
        pass: finalScore >= threshold,
      };
    } finally {
      this.fixtureManager.cleanup();
    }
  }

  /**
   * Parses the stream-json output from Claude CLI into structured data.
   * Stream-json format emits one JSON object per line.
   */
  private parseOutput(stdout: string): ParsedAgentOutput {
    const toolCalls: ParsedToolCall[] = [];
    let responseText = "";

    const lines = stdout.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      try {
        const event = JSON.parse(line);

        // Collect tool use events
        if (event.type === "tool_use" || event.type === "content_block_start") {
          const block = event.type === "content_block_start" ? event.content_block : event;
          if (block?.type === "tool_use" && block.name) {
            toolCalls.push({
              toolName: block.name,
              input: block.input ?? {},
            });
          }
        }

        // Collect assistant text messages
        if (event.type === "result") {
          if (typeof event.result === "string") {
            responseText += event.result;
          }
        }

        // Collect text content blocks
        if (event.type === "content_block_start" && event.content_block?.type === "text") {
          if (event.content_block.text) {
            responseText += event.content_block.text;
          }
        }
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          responseText += event.delta.text ?? "";
        }

        // Handle message-level content for assistant messages
        if (event.type === "assistant" && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === "tool_use") {
              toolCalls.push({
                toolName: block.name,
                input: block.input ?? {},
              });
            }
            if (block.type === "text") {
              responseText += block.text;
            }
          }
        }

        // Extract tool result content from user messages (MCP tool output)
        if (event.type === "user") {
          if (event.tool_use_result) {
            const toolResult = typeof event.tool_use_result === "string"
              ? event.tool_use_result
              : JSON.stringify(event.tool_use_result);
            responseText += "\n" + toolResult;
          }
          if (event.message?.content) {
            for (const block of Array.isArray(event.message.content) ? event.message.content : []) {
              if (block.type === "tool_result" && typeof block.content === "string") {
                responseText += "\n" + block.content;
              }
            }
          }
        }
      } catch {
        // Not a JSON line, append as raw text
        responseText += line + "\n";
      }
    }

    return { responseText, toolCalls };
  }

  /**
   * Creates a progress indicator that works in both TTY and piped modes.
   */
  private createProgressIndicator(): { update: (label: string) => void; stop: () => void } {
    const isTTY = process.stdout.isTTY ?? false;
    const start = Date.now();
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let frameIdx = 0;
    let currentLabel = "";
    let timer: ReturnType<typeof setInterval> | null = null;

    const update = (label: string): void => {
      currentLabel = label;
      if (isTTY) {
        if (timer) clearInterval(timer);
        timer = setInterval(() => {
          const elapsed = this.formatDuration(Date.now() - start);
          const frame = frames[frameIdx % frames.length];
          process.stdout.write(`\r       ${chalk.cyan(frame)} ${chalk.dim(currentLabel)}  ${chalk.yellow(elapsed)}   `);
          frameIdx++;
        }, 100);
      } else {
        const elapsed = this.formatDuration(Date.now() - start);
        console.log(chalk.dim(`       → ${label}  ${elapsed}`));
      }
    };

    const stop = (): void => {
      if (timer) clearInterval(timer);
      if (isTTY) {
        process.stdout.write("\r" + " ".repeat(80) + "\r");
      }
    };

    return { update, stop };
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  private truncate(str: string, max: number): string {
    const oneLine = str.replace(/\n/g, " ").trim();
    if (oneLine.length <= max) return oneLine;
    return oneLine.slice(0, max - 1) + "…";
  }

  private computeSummary(
    results: CaseResult[],
    judgeEnabled: boolean
  ): EvalSummary {
    const totalCases = results.length;
    const passedCases = results.filter((r) => r.pass).length;
    const failedCases = totalCases - passedCases;
    const passRate = totalCases > 0 ? passedCases / totalCases : 0;
    const averageScore =
      totalCases > 0
        ? results.reduce((sum, r) => sum + r.finalScore, 0) / totalCases
        : 0;

    let averageByDimension: EvalSummary["averageByDimension"] = null;
    if (judgeEnabled) {
      const judgeResults = results.filter((r) => r.judgeScore !== null);
      if (judgeResults.length > 0) {
        averageByDimension = {
          factualAccuracy:
            judgeResults.reduce(
              (sum, r) => sum + r.judgeScore!.factualAccuracy.score,
              0
            ) / judgeResults.length,
          completeness:
            judgeResults.reduce(
              (sum, r) => sum + r.judgeScore!.completeness.score,
              0
            ) / judgeResults.length,
          toolEfficiency:
            judgeResults.reduce(
              (sum, r) => sum + r.judgeScore!.toolEfficiency.score,
              0
            ) / judgeResults.length,
          responseQuality:
            judgeResults.reduce(
              (sum, r) => sum + r.judgeScore!.responseQuality.score,
              0
            ) / judgeResults.length,
        };
      }
    }

    const sorted = [...results].sort((a, b) => a.finalScore - b.finalScore);
    const worstCases = sorted.slice(0, 3).map((r) => ({
      testCaseId: r.testCaseId,
      score: r.finalScore,
    }));

    return {
      totalCases,
      passedCases,
      failedCases,
      passRate,
      averageScore,
      averageByDimension,
      worstCases,
    };
  }
}
