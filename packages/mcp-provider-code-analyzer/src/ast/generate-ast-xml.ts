import { PmdCliAstXmlAdapter } from "./pmd-cli-adapter.js";

/**
 * Generates AST XML for the given source code using the PMD CLI.
 * Assumes the PMD bin folder path is provided and will be used as the cwd.
 */
export async function generateAstXmlFromSource(
  code: string,
  language: string
): Promise<string> {
  const adapter = new PmdCliAstXmlAdapter();
  return adapter.generateAstXml(code, language);
}
