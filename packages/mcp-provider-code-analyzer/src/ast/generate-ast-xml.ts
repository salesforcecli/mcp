import { PmdEngineAstXmlAdapter } from "./pmd-engine-adapter.js";
import { PmdEngine } from "@salesforce/code-analyzer-pmd-engine";

// Cache the engine instance to avoid recreating it for each request (better performance)
let cachedPmdEngine: PmdEngine | null = null;
let cachedAdapter: PmdEngineAstXmlAdapter | null = null;

/**
 * Generates AST XML for the given source code using PMD Engine API.
 * The engine instance is cached for better performance on subsequent calls.
 * No longer requires PMD CLI to be installed.
 */
export async function generateAstXmlFromSource(
  code: string,
  language: string
): Promise<string> {
  if (!cachedPmdEngine) {
    // Create PMD engine with minimal configuration needed for AST generation
    // We only need java_command and empty arrays for the rest since AST generation
    // doesn't require rules or custom configuration
    const config = {
      java_command: "java",
      java_classpath_entries: [],
      custom_rulesets: [],
      rule_languages: ["apex", "visualforce", "xml", "html", "javascript"],
      file_extensions: {
        apex: [".cls", ".trigger"],
        visualforce: [".page", ".component"],
        xml: [".xml"],
        html: [".html"],
        javascript: [".js"]
      }
    };

    cachedPmdEngine = new PmdEngine(config as any);
    cachedAdapter = new PmdEngineAstXmlAdapter(cachedPmdEngine);
  }

  return cachedAdapter!.generateAstXml(code, language);
}
