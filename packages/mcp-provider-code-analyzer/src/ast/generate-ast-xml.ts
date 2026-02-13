import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getErrorMessage } from "../utils.js";

// Executes PMD to produce AST XML from source code.
const execFileAsync = promisify(execFile);

function sanitizeExtension(language: string): string {
  const cleaned = (language ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned.length > 0 ? cleaned : "txt";
}

/**
 * Generates AST XML for the given source code using the PMD CLI.
 * Assumes the PMD bin folder path is provided and will be used as the cwd.
 */
export async function generateAstXmlFromSource(
  code: string,
  language: string
): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pmd-ast-"));
  const sourceFile = path.join(tempDir, `source.${sanitizeExtension(language)}`);

  try {
    await fs.writeFile(sourceFile, code, "utf8");
    const stdout = await runPmdAstDump(language, sourceFile);
    return stdout.trim();
  } catch (error) {
    const message = getErrorMessage(error);
    if (message.toLowerCase().includes("enoent")) {
      throw new Error("PMD CLI not found on PATH. Install PMD and ensure `pmd` is available in your PATH.");
    }
    throw new Error(`Failed to generate AST XML via PMD: ${message}`);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function runPmdAstDump(language: string, sourceFile: string): Promise<string> {
  const { stdout } = await execFileAsync(
    "pmd",
    ["ast-dump", "--language", language, "--format", "xml", "--file", sourceFile],
    {
      maxBuffer: 10 * 1024 * 1024
    }
  );
  return stdout;
}
