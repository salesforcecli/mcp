import { describe, expect, it, vi } from "vitest";

const generateAstXmlMock = vi.fn();

vi.mock("../../src/ast/pmd-engine-adapter.js", () => ({
  PmdEngineAstXmlAdapter: class {
    constructor(_pmdEngine: any) {}
    public generateAstXml(code: string, language: string): Promise<string> {
      return generateAstXmlMock(code, language);
    }
  }
}));

vi.mock("@salesforce/code-analyzer-pmd-engine", () => ({
  PmdEngine: class {
    constructor(_config: any) {}
  }
}));

describe("generateAstXmlFromSource", () => {
  it("delegates to the PMD Engine adapter", async () => {
    generateAstXmlMock.mockResolvedValueOnce("<xml/>");
    const { generateAstXmlFromSource } = await import("../../src/ast/generate-ast-xml.js");

    const result = await generateAstXmlFromSource("class X {}", "apex");

    expect(generateAstXmlMock).toHaveBeenCalledTimes(1);
    expect(generateAstXmlMock).toHaveBeenCalledWith("class X {}", "apex");
    expect(result).toBe("<xml/>");
  });

  it("propagates adapter errors", async () => {
    generateAstXmlMock.mockRejectedValueOnce(new Error("boom"));
    const { generateAstXmlFromSource } = await import("../../src/ast/generate-ast-xml.js");

    await expect(generateAstXmlFromSource("class X {}", "apex")).rejects.toThrow("boom");
  });
});
