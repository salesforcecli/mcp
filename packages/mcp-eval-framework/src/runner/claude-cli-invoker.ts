import { spawn } from "node:child_process";
import type { CliInvocationResult, CliInvokerConfig } from "../types.js";

const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_MODEL = "haiku";

/**
 * Wraps Claude Code CLI invocation using `claude -p` (print mode).
 * Captures tool call metadata via `--output-format stream-json --verbose`.
 *
 * The agent has access to its full toolkit (built-in + MCP). The scoring
 * layer evaluates whether it selected the right tool. If the agent uses
 * a different approach, that's a meaningful signal for tool-efficiency scoring.
 *
 * --dangerously-skip-permissions auto-approves built-in tools.
 * --allowedTools auto-approves MCP tools matching the pattern (without this,
 * MCP tools prompt for permission even with --dangerously-skip-permissions).
 *
 * Uses spawn with stdio: ["ignore", "pipe", "pipe"] so stdin is /dev/null.
 * Without this, claude hangs waiting for TTY input when run via child_process.
 */
export class ClaudeCliInvoker {
  private readonly config: CliInvokerConfig;

  constructor(config: CliInvokerConfig) {
    this.config = config;
  }

  /**
   * Invokes Claude CLI with the given prompt and returns the full output.
   *
   * @param prompt - The natural language prompt to send
   * @returns CLI invocation result with stdout, stderr, exitCode, durationMs
   */
  async invoke(prompt: string): Promise<CliInvocationResult> {
    const model = this.config.model ?? DEFAULT_MODEL;
    const timeoutMs = this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const args = [
      "-p", prompt,
      "--output-format", "stream-json",
      "--verbose",
      "--model", model,
      "--dangerously-skip-permissions",
      "--allowedTools", this.config.allowedToolsPattern,
    ];

    if (this.config.mcpConfigPath) {
      args.push("--mcp-config", this.config.mcpConfigPath);
    }

    const startTime = Date.now();

    return new Promise<CliInvocationResult>((resolve) => {
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      const child = spawn("claude", args, {
        cwd: this.config.workingDirectory,
        // 'ignore' stdin so claude doesn't hang waiting for TTY input
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, CLAUDECODE: "" },
      });

      child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

      // Timeout guard
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
      }, timeoutMs);

      child.on("close", (code) => {
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;
        resolve({
          stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
          stderr: Buffer.concat(stderrChunks).toString("utf-8"),
          exitCode: code ?? 1,
          durationMs,
        });
      });
    });
  }
}
