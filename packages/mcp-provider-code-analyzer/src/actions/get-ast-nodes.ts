import { generateAstXmlFromSource } from "../ast/generate-ast-xml.js";
import { type AstNode, extractAstNodesFromXml } from "../ast/extract-ast-nodes.js";

export type GetAstNodesInput = {
  code: string;
  language: string;
};

export type GetAstNodesOutput = {
  status: string;
  nodes: AstNode[];
};

export interface GetAstNodesAction {
  exec(input: GetAstNodesInput): Promise<GetAstNodesOutput>;
}

export class GetAstNodesActionImpl implements GetAstNodesAction {
  public async exec(input: GetAstNodesInput): Promise<GetAstNodesOutput> {
    try {
      const pmdBinPath = process.env.PMD_BIN_PATH ?? "/Users/arun.tyagi/Downloads/pmd-bin-7.21.0/bin";
      if (!pmdBinPath) {
        throw new Error("Missing PMD bin path. Provide pmdBinPath or set PMD_BIN_PATH.");
      }

      // TODO: Spike note:
      // - Currently shelling out to the PMD CLI (`./pmd ast-dump`) to generate AST XML.
      // - This is a temporary approach for early prototyping and should not be considered final.
      // - Replace this with a direct PMD Java API integration or a Code Analyzer core API call.
      // - When replacing, remove dependency on local PMD bin path and avoid spawning external processes.
      const astXml = await generateAstXmlFromSource(input.code, input.language, pmdBinPath);
      const nodes = extractAstNodesFromXml(astXml);
      return { status: "success", nodes };
    } catch (e) {
      return { status: (e as Error)?.message ?? String(e), nodes: [] };
    }
  }
}


/**
 * Generates AST XML for the given source code using PMD CLI.
 * This is a utility-style export so it can be wired into the action later
 * without altering the existing flow in this file.
 */
export async function generateAstXml(
  code: string,
  language: string,
  pmdBinPath: string
): Promise<string> {
  const { generateAstXmlFromSource } = await import("../ast/generate-ast-xml.js");
  return generateAstXmlFromSource(code, language, pmdBinPath);
}

/**
 * Returns a list of AST node identifiers for the given source code.
 * Minimal implementation with zero external dependencies:
 * - For 'xml' or 'html' languages, returns tag names encountered in document order (unique, case-preserving).
 * - For other languages, returns an empty list (placeholder).
 *
 * This function is intentionally lightweight to avoid runtime dependencies.
 *
 * @param code - The source code as a string
 * @param language - The language of the source code (e.g., "xml", "html", "typescript", "javascript", "apex")
 * @returns An array of strings representing AST nodes
 */
export function getAstNodes(code: string, language: string): string[] {
  const lang = (language ?? '').toLowerCase().trim();
    // 1. Read user utterance and normalize rule intent (engine, language, rule type)

    // 2. Generate minimal Apex sample code representing the rule violation

    // 3. Run PMD ast-dump on generated Apex code to produce AST XML

    // 4. Parse AST XML and extract all AST nodes with hierarchy information

    // 5. Identify and filter relevant AST nodes required for the rule logic

    // 6. Enrich AST nodes using cached AST metadata (descriptions, attributes)

    // 7. Prepare structured prompt input using rule intent + relevant AST nodes

    // 8. Call LLM to generate XPath expression based on AST structure

    // 9. Validate generated XPath against extracted AST nodes

    // 10. Generate custom PMD rule XML using rule template and XPath

    // 11. Create or update custom PMD rules XML file

    // 12. Create or update code-analyzer configuration to reference custom rules

    // 13. (Optional) Run PMD with sample code to validate rule behavior

  return [];
}
