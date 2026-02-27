#!/usr/bin/env tsx
/**
 * MCP Agent Evaluation — Scale Products (Apex Antipatterns)
 *
 * Prerequisites:
 *   1. Configure the salesforce MCP server in your Claude Code settings
 *      (or provide --mcp-config pointing to a local config file)
 *   2. Verify it's working: `claude mcp list` should show salesforce as connected
 *
 * Usage:
 *   tsx eval/run-eval.ts                         # Full eval with LLM judge
 *   tsx eval/run-eval.ts --skip-judge            # Fast mode (deterministic only)
 *   tsx eval/run-eval.ts --filter simple         # Filter test cases by ID/description
 *   tsx eval/run-eval.ts --model opus            # Use a specific model
 *   tsx eval/run-eval.ts --mcp-config path.json  # Explicit MCP server config
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import chalk from "chalk";
import { EvalRunner, ConsoleReporter, JsonReporter } from "@salesforce/mcp-eval-framework";
import type { TestCase } from "@salesforce/mcp-eval-framework";
import { apexAntipatternAdapter } from "./adapter/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv: string[]): {
  skipJudge: boolean;
  filter?: string;
  model?: string;
  judgeModel?: string;
  mcpConfig?: string;
} {
  let skipJudge = false;
  let filter: string | undefined;
  let model: string | undefined;
  let judgeModel: string | undefined;
  let mcpConfig: string | undefined;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--skip-judge") {
      skipJudge = true;
    } else if (arg === "--filter" && i + 1 < argv.length) {
      filter = argv[++i];
    } else if (arg === "--model" && i + 1 < argv.length) {
      model = argv[++i];
    } else if (arg === "--judge-model" && i + 1 < argv.length) {
      judgeModel = argv[++i];
    } else if (arg === "--mcp-config" && i + 1 < argv.length) {
      mcpConfig = argv[++i];
    }
  }

  return { skipJudge, filter, model, judgeModel, mcpConfig };
}

function loadTestCases(testCasesDir: string): TestCase[] {
  const yamlFiles = fs
    .readdirSync(testCasesDir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();

  const allCases: TestCase[] = [];
  for (const file of yamlFiles) {
    const filePath = path.join(testCasesDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const cases = parseYaml(content) as TestCase[];
    if (Array.isArray(cases)) {
      allCases.push(...cases);
    }
  }
  return allCases;
}

function preflightCheck(): void {
  try {
    execSync("claude --version", {
      stdio: "pipe",
      env: { ...process.env, CLAUDECODE: "" },
    });
  } catch {
    console.error("Error: 'claude' CLI not found. Install Claude Code first.");
    process.exit(1);
  }

  console.log(
    "Preflight: Claude CLI found. Ensure your salesforce MCP server is configured and working.\n" +
    "  Verify with: claude mcp list\n"
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  preflightCheck();

  // Auto-detect local mcp-config.json if no explicit config was provided.
  // Using --mcp-config causes the spawned claude process to load ONLY those
  // servers (not the project-level ones which are tied to your working dir).
  const localMcpConfig = path.join(__dirname, "mcp-config.json");
  const mcpConfigPath = args.mcpConfig ?? (fs.existsSync(localMcpConfig) ? localMcpConfig : undefined);

  const testCases = loadTestCases(path.join(__dirname, "test-cases"));
  if (testCases.length === 0) {
    console.error("No test cases found. Check eval/test-cases/ directory.");
    process.exit(1);
  }

  // Filter for banner display (runner also filters internally)
  let filteredCases = testCases;
  if (args.filter) {
    const pattern = args.filter.toLowerCase();
    filteredCases = testCases.filter(
      (tc) =>
        tc.id.toLowerCase().includes(pattern) ||
        tc.description.toLowerCase().includes(pattern)
    );
  }

  const agentModel = args.model ?? "sonnet";
  const judgeLabel = args.skipJudge
    ? chalk.yellow("off (fast mode)")
    : chalk.green(args.judgeModel ?? "sonnet");

  console.log("");
  console.log(chalk.bold("⚡ MCP Agent Evaluation"));
  console.log(chalk.dim("─".repeat(50)));
  console.log(`  Agent model:   ${chalk.cyan(agentModel)}`);
  console.log(`  Judge model:   ${judgeLabel}`);
  console.log(`  Test cases:    ${chalk.bold(String(filteredCases.length))} of ${testCases.length} loaded`);
  if (mcpConfigPath) {
    const label = args.mcpConfig ? chalk.cyan(path.basename(mcpConfigPath)) : chalk.dim(`${path.basename(mcpConfigPath)} (auto-detected)`);
    console.log(`  MCP config:    ${label}`);
  }
  if (args.filter) {
    console.log(`  Filter:        ${chalk.yellow(args.filter)}`);
  }
  console.log(chalk.dim("─".repeat(50)));

  const resultsDir = path.join(__dirname, "results");
  fs.mkdirSync(resultsDir, { recursive: true });

  // Write partial results after each case so progress isn't lost if the run is killed.
  const runTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const partialPath = path.join(resultsDir, `eval-partial-${runTimestamp}.json`);
  const partialResults: import("@salesforce/mcp-eval-framework").CaseResult[] = [];

  const runner = new EvalRunner(__dirname, apexAntipatternAdapter, {
    model: args.model,
    judgeModel: args.judgeModel,
    skipJudge: args.skipJudge,
    filter: args.filter,
    mcpConfigPath,
    onCaseComplete(result, completed, total) {
      partialResults.push(result);
      fs.writeFileSync(partialPath, JSON.stringify(partialResults, null, 2), "utf-8");
      console.log(chalk.dim(`       [${completed}/${total}] partial results flushed → ${path.basename(partialPath)}`));
    },
  });
  const report = await runner.run(testCases);

  // Remove the partial file now that we have the full report
  if (fs.existsSync(partialPath)) fs.unlinkSync(partialPath);

  const consoleReporter = new ConsoleReporter(apexAntipatternAdapter);
  consoleReporter.report(report);

  const jsonReporter = new JsonReporter(resultsDir);
  const jsonPath = jsonReporter.report(report);
  console.log(`JSON report written to: ${jsonPath}`);

  process.exit(report.summary.failedCases > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Evaluation failed:", error);
  process.exit(2);
});
