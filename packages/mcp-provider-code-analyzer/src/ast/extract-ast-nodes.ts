import { XMLParser } from "fast-xml-parser";
import * as fs from "node:fs";

export interface AstNode {
  nodeName: string;
  attributes: Record<string, string>;
  parent?: string;
  ancestors: string[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  ignoreDeclaration: true,
});

/**
 * Recursively traverse XML object tree.
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

function parseAstXml(xml: string): AstNode[] {
  const parsed = parser.parse(xml);

  const rootName = Object.keys(parsed).find((key) => key !== "?xml") ?? Object.keys(parsed)[0];
  const rootNode = parsed[rootName];

  return traverse(rootNode, rootName, []);
}

/**
 * Load and process AST XML from a file path.
 */
export function extractAstNodes(xmlPath: string): AstNode[] {
  const xml = fs.readFileSync(xmlPath, "utf8");
  return parseAstXml(xml);
}

/**
 * Process AST XML from a raw XML string.
 */
export function extractAstNodesFromXml(xml: string): AstNode[] {
  return parseAstXml(xml);
}
