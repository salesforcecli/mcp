import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { PmdEngine, PmdAstDumpResults } from "@salesforce/code-analyzer-pmd-engine";
import { getErrorMessage } from "../utils.js";

/**
 * Interface for AST XML adapters
 */
export interface AstXmlAdapter {
  generateAstXml(code: string, language: string): Promise<string>;
}

/**
 * Adapter that uses PMD Engine's generateAst API instead of PMD CLI
 */
export class PmdEngineAstXmlAdapter implements AstXmlAdapter {
  private readonly pmdEngine: PmdEngine;

  constructor(pmdEngine: PmdEngine) {
    this.pmdEngine = pmdEngine;
  }

  public async generateAstXml(code: string, language: string): Promise<string> {
    enforceMaxSourceSize(code);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pmd-ast-"));
    const sourceFile = path.join(tempDir, `source.${sanitizeExtension(language)}`);

    try {
      // Write source code to temp file
      await fs.writeFile(sourceFile, code, "utf8");

      // Use PMD Engine's generateAst method
      const result: PmdAstDumpResults = await this.pmdEngine.generateAst(
        normalizePmdLanguage(language),
        sourceFile,
        {
          encoding: "UTF-8",
          workingFolder: tempDir
        }
      );

      // Handle error case
      if (result.error) {
        throw new Error(`PMD Engine error: ${result.error.message}`);
      }

      // Return the AST XML
      if (!result.ast) {
        throw new Error("PMD Engine returned no AST and no error");
      }

      return result.ast.trim();
    } catch (error) {
      const message = getErrorMessage(error);
      throw new Error(`Failed to generate AST XML via PMD Engine: ${message}`);
    } finally {
      // Clean up temp directory
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}

const MAX_SOURCE_BYTES = 1_000_000;

function enforceMaxSourceSize(code: string): void {
  const size = Buffer.byteLength(code ?? "", "utf8");
  if (size > MAX_SOURCE_BYTES) {
    throw new Error(`Source exceeds ${MAX_SOURCE_BYTES} bytes. Provide a smaller snippet.`);
  }
}

function sanitizeExtension(language: string): string {
  const cleaned = (language ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned.length > 0 ? cleaned : "txt";
}

/**
 * Normalize language names to match PMD's expected identifiers
 * PMD uses specific language IDs like "apex", "visualforce", "xml", etc.
 */
function normalizePmdLanguage(language: string): string {
  const normalized = (language ?? "").toLowerCase().trim();

  // Map common variations to PMD language IDs
  const languageMap: Record<string, string> = {
    "apex": "apex",
    "visualforce": "visualforce",
    "vf": "visualforce",
    "xml": "xml",
    "html": "html",
    "javascript": "javascript",
    "js": "javascript",
    "ecmascript": "javascript"
  };

  return languageMap[normalized] || normalized;
}
