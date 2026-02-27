import * as fs from "node:fs";
import * as path from "node:path";
import type { EvalReport } from "../types.js";

/**
 * JSON reporter: writes the full EvalReport to a timestamped file
 * in eval/results/.
 */
export class JsonReporter {
  private readonly resultsDir: string;

  constructor(resultsDir: string) {
    this.resultsDir = resultsDir;
  }

  /**
   * Writes the evaluation report to a JSON file.
   * Returns the path to the written file.
   */
  report(evalReport: EvalReport): string {
    fs.mkdirSync(this.resultsDir, { recursive: true });

    const timestamp = evalReport.timestamp.replace(/[:.]/g, "-");
    const fileName = `eval-${timestamp}.json`;
    const filePath = path.join(this.resultsDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify(evalReport, null, 2), "utf-8");

    return filePath;
  }
}
