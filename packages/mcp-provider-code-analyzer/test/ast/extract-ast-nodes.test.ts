import { describe, expect, it, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { extractAstNodes } from "../../src/ast/extract-ast-nodes.js";

let tempDir: string | undefined;

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "mcp-ast-"));
}

async function cleanupTempDir(): Promise<void> {
  if (!tempDir) {
    return;
  }
  await fs.rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
}

describe("extractAstNodes", () => {
  afterEach(async () => {
    await cleanupTempDir();
  });

  it("reads XML from a file path and parses nodes", async () => {
    tempDir = await createTempDir();
    const xmlPath = path.join(tempDir, "ast.xml");
    const xml = [
      "<CompilationUnit>",
      "  <ClassDeclaration Name=\"Example\">",
      "    <MethodDeclaration Name=\"doWork\" />",
      "  </ClassDeclaration>",
      "</CompilationUnit>"
    ].join("\n");

    await fs.writeFile(xmlPath, xml, "utf8");

    const nodes = extractAstNodes(xmlPath);

    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes[0].nodeName).toBe("CompilationUnit");
  });
});
