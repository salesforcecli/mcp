import chalk from "chalk";
import type { EvalReport, CaseResult, EvalSummary } from "../types.js";
import type { EvalAdapter } from "../adapter.js";

/**
 * Console reporter: prints color-coded eval results to stdout.
 * Domain-specific per-case details are delegated to adapter.formatEndStateDetails().
 */
export class ConsoleReporter {
  private readonly adapter: EvalAdapter;

  constructor(adapter: EvalAdapter) {
    this.adapter = adapter;
  }

  report(evalReport: EvalReport): void {
    this.printHeader(evalReport);
    this.printCaseResults(evalReport.results);
    this.printSummary(evalReport.summary, evalReport.config.judgeEnabled);
  }

  private printHeader(report: EvalReport): void {
    console.log("");
    console.log(chalk.bold("MCP Agent Evaluation Report"));
    console.log(chalk.gray("─".repeat(60)));
    console.log(`  Timestamp:  ${report.timestamp}`);
    console.log(`  Model:      ${report.config.model}`);
    const judgeLabel = report.config.judgeEnabled
      ? `enabled (${report.config.judgeModel ?? "sonnet"})`
      : "disabled (fast mode)";
    console.log(`  Judge:      ${judgeLabel}`);
    console.log(`  Threshold:  ${report.config.passThreshold}/5.0`);
    if (report.config.filter) {
      console.log(`  Filter:     ${report.config.filter}`);
    }
    console.log(chalk.gray("─".repeat(60)));
    console.log("");
  }

  private printCaseResults(results: CaseResult[]): void {
    for (const result of results) {
      this.printCaseResult(result);
    }
  }

  private printCaseResult(result: CaseResult): void {
    const statusIcon = result.pass ? chalk.green("PASS") : chalk.red("FAIL");
    const scoreStr = result.finalScore.toFixed(2);

    console.log(
      `${statusIcon}  ${chalk.bold(result.testCaseId)} (${scoreStr}/5.0)`
    );
    console.log(chalk.gray(`       ${result.description}`));

    // Generic deterministic checks
    const es = result.endStateScore;
    const toolCheck = es.toolSelected ? chalk.green("yes") : chalk.red("no");
    const callsCheck = es.toolCallCountWithinMax
      ? chalk.green(`${es.toolCallCount}`)
      : chalk.red(`${es.toolCallCount} (exceeded max)`);

    console.log(
      chalk.gray(`       Tool selected: ${toolCheck}  |  Tool calls: ${callsCheck}`)
    );

    // Domain-specific details from adapter
    const details = this.adapter.formatEndStateDetails(es);
    for (const line of details) {
      console.log(chalk.gray(`       ${line}`));
    }

    // Judge scores
    if (result.judgeScore) {
      const js = result.judgeScore;
      console.log(
        chalk.gray(
          `       Judge: factual=${js.factualAccuracy.score} completeness=${js.completeness.score} efficiency=${js.toolEfficiency.score} quality=${js.responseQuality.score} => composite=${js.compositeScore.toFixed(2)}`
        )
      );
    }

    console.log("");
  }

  private printSummary(summary: EvalSummary, judgeEnabled: boolean): void {
    console.log(chalk.gray("═".repeat(60)));
    console.log(chalk.bold("Summary"));
    console.log(chalk.gray("─".repeat(60)));

    const passRateColor =
      summary.passRate >= 0.8
        ? chalk.green
        : summary.passRate >= 0.5
          ? chalk.yellow
          : chalk.red;

    console.log(`  Total:    ${summary.totalCases} cases`);
    console.log(
      `  Passed:   ${chalk.green(String(summary.passedCases))}  |  Failed: ${chalk.red(String(summary.failedCases))}`
    );
    console.log(
      `  Pass rate: ${passRateColor((summary.passRate * 100).toFixed(1) + "%")}`
    );
    console.log(`  Avg score: ${summary.averageScore.toFixed(2)}/5.0`);

    if (judgeEnabled && summary.averageByDimension) {
      const dim = summary.averageByDimension;
      console.log("");
      console.log(chalk.bold("  Per-Dimension Averages:"));
      console.log(`    Factual accuracy: ${dim.factualAccuracy.toFixed(2)}`);
      console.log(`    Completeness:     ${dim.completeness.toFixed(2)}`);
      console.log(`    Tool efficiency:  ${dim.toolEfficiency.toFixed(2)}`);
      console.log(`    Response quality: ${dim.responseQuality.toFixed(2)}`);
    }

    if (summary.worstCases.length > 0) {
      console.log("");
      console.log(chalk.bold("  Worst Cases:"));
      for (const wc of summary.worstCases) {
        console.log(
          chalk.red(`    ${wc.testCaseId}: ${wc.score.toFixed(2)}/5.0`)
        );
      }
    }

    console.log(chalk.gray("═".repeat(60)));
    console.log("");
  }
}
