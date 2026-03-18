import { describe, expect, it, vi } from "vitest";

const generateAstXmlFromSourceMock = vi.fn();

vi.mock("../../src/ast/generate-ast-xml.js", () => ({
  generateAstXmlFromSource: generateAstXmlFromSourceMock
}));

describe("engine strategies", () => {
  it("returns PMD strategy and generates AST XML via generator", async () => {
    generateAstXmlFromSourceMock.mockResolvedValueOnce("<xml/>");
    const { getEngineStrategy } = await import("../../src/engines/engine-strategies.js");
    const strategy = getEngineStrategy("pmd");

    const result = await strategy.astGenerator.generateAstXml("class X {}", "apex");

    expect(result).toBe("<xml/>");
    expect(generateAstXmlFromSourceMock).toHaveBeenCalledWith("class X {}", "apex");
  });

  it("returns metadata only for Apex language", async () => {
    const { getEngineStrategy } = await import("../../src/engines/engine-strategies.js");
    const strategy = getEngineStrategy("pmd");

    const apexMeta = await strategy.metadataProvider.getMetadata("apex", ["UserClass"]);
    const jsMeta = await strategy.metadataProvider.getMetadata("javascript", ["Foo"]);

    // Apex should return metadata with full details
    expect(apexMeta).toHaveLength(1);
    expect(apexMeta[0]).toMatchObject({
      name: "UserClass",
      category: "Declarations",
      description: expect.any(String)
    });
    expect(apexMeta[0].attributes).toBeDefined();

    // JavaScript should return empty array (no metadata found for "Foo")
    expect(jsMeta).toEqual([]);
  });

  it("treats missing language as non-Apex for metadata", async () => {
    const { getEngineStrategy } = await import("../../src/engines/engine-strategies.js");
    const strategy = getEngineStrategy("pmd");

    const meta = await strategy.metadataProvider.getMetadata(undefined as unknown as string, ["UserClass"]);

    expect(meta).toEqual([]);
  });

  it("builds a PMD prompt with AST node summaries", async () => {
    const { getEngineStrategy } = await import("../../src/engines/engine-strategies.js");
    const strategy = getEngineStrategy("pmd");

    const prompt = strategy.promptBuilder.buildPrompt({
      language: "apex",
      engine: "pmd",
      astNodes: [
        {
          nodeName: "MethodCallExpression",
          attributes: { FullMethodName: "System.debug" },
          parent: "BlockStatement",
          ancestors: ["CompilationUnit", "UserClass"]
        }
      ],
      astMetadata: [
        {
          name: "MethodCallExpression",
          description: "Represents a method call"
        }
      ]
    });

    expect(prompt).toContain("You are generating a PMD XPath query.");
    expect(prompt).toContain("MethodCallExpression");
    expect(prompt).toContain("System.debug");
    expect(prompt).toContain("Create the XPath");
  });

  it("includes null parent when AST node has no parent", async () => {
    const { getEngineStrategy } = await import("../../src/engines/engine-strategies.js");
    const strategy = getEngineStrategy("pmd");

    const prompt = strategy.promptBuilder.buildPrompt({
      language: "apex",
      engine: "pmd",
      astNodes: [
        {
          nodeName: "CompilationUnit",
          attributes: {},
          parent: undefined,
          ancestors: []
        }
      ],
      astMetadata: []
    });

    expect(prompt).toContain('"parent": null');
  });

  it("throws for unsupported engines", async () => {
    const { getEngineStrategy } = await import("../../src/engines/engine-strategies.js");
    expect(() => getEngineStrategy("eslint")).toThrow("engine 'eslint' is not supported yet");
  });

  it("throws for empty engine value", async () => {
    const { getEngineStrategy } = await import("../../src/engines/engine-strategies.js");
    expect(() => getEngineStrategy("")).toThrow("engine '' is not supported yet");
  });
});
