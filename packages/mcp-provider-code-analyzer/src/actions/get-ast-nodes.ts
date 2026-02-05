export type GetAstNodesInput = {
  code: string;
  language: string;
};

export type GetAstNodesOutput = {
  status: string;
  nodes: string[];
};

export interface GetAstNodesAction {
  exec(input: GetAstNodesInput): Promise<GetAstNodesOutput>;
}

export class GetAstNodesActionImpl implements GetAstNodesAction {
  public async exec(input: GetAstNodesInput): Promise<GetAstNodesOutput> {
    try {
      const nodes = extractAstNodeNames(input.code, input.language);
      return { status: "success", nodes };
    } catch (e) {
      return { status: (e as Error)?.message ?? String(e), nodes: [] };
    }
  }
}

// ---- Minimal, dependency-free extraction helpers (xml/html only for now) ----
function extractAstNodeNames(code: string, language: string): string[] {
  const lang = (language ?? "").toLowerCase().trim();
  if (lang === "xml" || lang === "html") {
    return extractXmlTagNames(code);
  }
  // Placeholder for other languages
  return [];
}

function extractXmlTagNames(xmlLike: string): string[] {
  const results: string[] = [];
  const seen = new Set<string>();
  const length = xmlLike.length;

  let i = 0;
  while (i < length) {
    const ch = xmlLike.charCodeAt(i);
    if (ch !== CharCode.LT) {
      i++;
      continue;
    }
    const next = charAt(xmlLike, i + 1);
    if (next === "/" || next === "!" || next === "?") {
      i = advanceToNextTagEnd(xmlLike, i + 1);
      continue;
    }
    let j = i + 1;
    while (j < length && isWhitespace(xmlLike.charCodeAt(j))) j++;
    if (j >= length || !isNameStartChar(xmlLike.charCodeAt(j))) {
      i = advanceToNextTagEnd(xmlLike, j);
      continue;
    }
    const start = j;
    j++;
    while (j < length && isNameChar(xmlLike.charCodeAt(j))) j++;
    const name = xmlLike.slice(start, j);
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      results.push(name);
    }
    i = advanceToNextTagEnd(xmlLike, j);
  }
  return results;
}

const enum CharCode {
  LT = 60,
  GT = 62,
  SPACE = 32,
  TAB = 9,
  CR = 13,
  LF = 10,
  UNDERSCORE = 95,
  COLON = 58,
  DOT = 46,
  DASH = 45
}

function charAt(s: string, idx: number): string {
  return idx < s.length ? (s[idx] as string) : "";
}

function isWhitespace(code: number): boolean {
  return code === CharCode.SPACE || code === CharCode.TAB || code === CharCode.CR || code === CharCode.LF;
}

function isAsciiLetter(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isDigit(code: number): boolean {
  return code >= 48 && code <= 57;
}

function isNameStartChar(code: number): boolean {
  return isAsciiLetter(code) || code === CharCode.UNDERSCORE || code === CharCode.COLON;
}

function isNameChar(code: number): boolean {
  return isNameStartChar(code) || isDigit(code) || code === CharCode.DOT || code === CharCode.DASH;
}

function advanceToNextTagEnd(s: string, idx: number): number {
  const len = s.length;
  while (idx < len && s.charCodeAt(idx) !== CharCode.GT) idx++;
  return Math.min(idx + 1, len);
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

export default getAstNodes;


import { XMLParser } from "fast-xml-parser";
import * as fs from "fs";

interface AstNode {
  nodeName: string;
  attributes: Record<string, string>;
  parent?: string;
  ancestors: string[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

/**
 * Recursively traverse XML object tree
 */
function traverse(
  node: any,
  nodeName: string,
  ancestors: string[],
  parent?: string,
  result: AstNode[] = []
) {
  if (typeof node !== "object" || node === null) return result;

  // Extract attributes
  const attributes: Record<string, string> = {};
  for (const key of Object.keys(node)) {
    if (key.startsWith("@_")) {
      attributes[key.substring(2)] = String(node[key]);
    }
  }

  // Store current node
  result.push({
    nodeName,
    attributes,
    parent,
    ancestors,
  });

  // Traverse children
  for (const key of Object.keys(node)) {
    if (key.startsWith("@_") || key === "#text") continue;

    const child = node[key];

    if (Array.isArray(child)) {
      for (const c of child) {
        traverse(c, key, [...ancestors, nodeName], nodeName, result);
      }
    } else {
      traverse(child, key, [...ancestors, nodeName], nodeName, result);
    }
  }

  return result;
}

/**
 * Load and process AST XML
 */
function extractAstNodes(xmlPath: string): AstNode[] {
  const xml = fs.readFileSync(xmlPath, "utf8");
  const parsed = parser.parse(xml);

  const rootName = Object.keys(parsed)[0];
  const rootNode = parsed[rootName];

  return traverse(rootNode, rootName, []);
}
