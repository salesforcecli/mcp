import { spawn } from "node:child_process";
import type {
  ScoringConfig,
  JudgeScore,
  RubricResult,
} from "../types.js";
import type { RubricFn } from "../adapter.js";

const DEFAULT_JUDGE_MODEL = "sonnet";
const JUDGE_TIMEOUT_MS = 120_000;

/**
 * LLM-as-judge evaluator.
 * Uses Claude Code CLI (`claude -p`) to score agent responses
 * against rubrics across four dimensions.
 *
 * The judge runs in plain text mode (no --output-format stream-json)
 * with no tools, no MCP, and no permissions — it's a pure text-in/text-out
 * evaluation. Each rubric prompt is sent as a separate `claude -p` invocation.
 */
export class JudgeEvaluator {
  private readonly model: string;

  constructor(model?: string) {
    this.model = model ?? DEFAULT_JUDGE_MODEL;
  }

  /**
   * Evaluates an agent response across all four rubric dimensions.
   *
   * @param prompt - The prompt sent to the agent
   * @param agentOutput - The raw agent output (stdout from Claude CLI)
   * @param groundTruth - Natural language description of expected results (from adapter.formatGroundTruth)
   * @param rubrics - The four rubric functions from the adapter
   * @param scoring - Scoring weights from the test case
   */
  async evaluate(
    prompt: string,
    agentOutput: string,
    groundTruth: string,
    rubrics: {
      factualAccuracy: RubricFn;
      completeness: RubricFn;
      toolEfficiency: RubricFn;
      responseQuality: RubricFn;
    },
    scoring: ScoringConfig
  ): Promise<JudgeScore> {
    // Run all four rubrics in parallel
    const [factualAccuracy, completeness, toolEfficiency, responseQuality] =
      await Promise.all([
        this.scoreRubric(rubrics.factualAccuracy(prompt, agentOutput, groundTruth)),
        this.scoreRubric(rubrics.completeness(prompt, agentOutput, groundTruth)),
        this.scoreRubric(rubrics.toolEfficiency(prompt, agentOutput, groundTruth)),
        this.scoreRubric(rubrics.responseQuality(prompt, agentOutput, groundTruth)),
      ]);

    // Calculate weighted composite
    const compositeScore =
      factualAccuracy.score * scoring.factualAccuracy.weight +
      completeness.score * scoring.completeness.weight +
      toolEfficiency.score * scoring.toolEfficiency.weight +
      responseQuality.score * scoring.responseQuality.weight;

    return {
      factualAccuracy,
      completeness,
      toolEfficiency,
      responseQuality,
      compositeScore,
    };
  }

  /**
   * Sends a rubric prompt to Claude CLI in print mode and parses the score + justification.
   */
  private async scoreRubric(rubricPrompt: string): Promise<RubricResult> {
    try {
      const text = await this.invokeClaudeCli(rubricPrompt);
      return this.parseRubricResponse(text);
    } catch (error) {
      return {
        score: 0,
        justification: `Judge CLI error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Invokes `claude -p` with a rubric prompt and returns the plain text response.
   * No tools, no MCP, no permissions needed — pure text evaluation.
   */
  private invokeClaudeCli(prompt: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      const child = spawn("claude", [
        "-p", prompt,
        "--output-format", "text",
        "--model", this.model,
      ], {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, CLAUDECODE: "" },
      });

      child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`Judge CLI timed out after ${JUDGE_TIMEOUT_MS}ms`));
      }, JUDGE_TIMEOUT_MS);

      child.on("close", (code) => {
        clearTimeout(timer);
        const stdout = Buffer.concat(stdoutChunks).toString("utf-8");
        const stderr = Buffer.concat(stderrChunks).toString("utf-8");

        if (code !== 0) {
          reject(new Error(`Judge CLI exited with code ${code}: ${stderr}`));
          return;
        }

        resolve(stdout);
      });
    });
  }

  /**
   * Parses the LLM judge response to extract score and justification.
   * Expected format: JSON with { "score": number, "justification": string }
   * The model may wrap JSON in a ```json code block or output it inline.
   */
  private parseRubricResponse(text: string): RubricResult {
    // Strategy 1: Find JSON in a fenced code block (```json ... ```)
    const jsonBlock = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (jsonBlock) {
      try {
        const parsed = JSON.parse(jsonBlock[1]);
        if (typeof parsed.score === "number" && typeof parsed.justification === "string") {
          return {
            score: Math.min(5, Math.max(1, Math.round(parsed.score))),
            justification: parsed.justification,
          };
        }
      } catch {
        // Continue to next strategy
      }
    }

    // Strategy 2: Find any JSON object containing "score" in the text
    const jsonObjects = text.match(/\{[^{}]*"score"\s*:\s*\d[^{}]*\}/g);
    if (jsonObjects) {
      for (const jsonStr of jsonObjects) {
        try {
          const parsed = JSON.parse(jsonStr);
          if (typeof parsed.score === "number") {
            return {
              score: Math.min(5, Math.max(1, Math.round(parsed.score))),
              justification: typeof parsed.justification === "string"
                ? parsed.justification
                : text.slice(0, 500),
            };
          }
        } catch {
          // Continue
        }
      }
    }

    // Strategy 3: Extract "score": N from anywhere in the text
    const scoreMatch = text.match(/"score"\s*:\s*(\d)/);
    if (scoreMatch) {
      const justMatch = text.match(/"justification"\s*:\s*"([\s\S]*?)"/);
      return {
        score: parseInt(scoreMatch[1], 10),
        justification: justMatch ? justMatch[1] : text.slice(0, 500),
      };
    }

    // Strategy 4: Look for "score: N" or "Score: N" in plain text
    const plainScoreMatch = text.match(/\bscore\s*[:\s]\s*(\d)\b/i);
    return {
      score: plainScoreMatch ? parseInt(plainScoreMatch[1], 10) : 0,
      justification: text.slice(0, 500),
    };
  }
}
