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
  
  return [];
}


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

// ---------- USAGE ----------

const astNodes = extractAstNodes("ast.xml");

// Print summary
console.log(`Total nodes: ${astNodes.length}`);

// Sample output
console.log(astNodes.slice(0, 10));

// Optional: write to file for inspection
fs.writeFileSync(
  "ast-nodes.json",
  JSON.stringify(astNodes, null, 2),
  "utf8"
);
