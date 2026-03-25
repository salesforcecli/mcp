import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AstNodeMetadata } from "../../../src/ast/metadata/pmd-ast-reference.js";

// Mock fs to control file reads
const mockReadFile = vi.fn();
vi.mock("node:fs/promises", () => ({
  default: {
    readFile: mockReadFile
  }
}));

const apexAstReference = {
  description: "Apex AST Node Reference",
  nodes: [
    {
      name: "ClassDeclaration",
      description: "Represents a class declaration",
      category: "Type",
      attributes: [
        { name: "Name", type: "String", description: "Class name" }
      ]
    },
    {
      name: "MethodDeclaration",
      description: "Represents a method declaration",
      category: "Member",
      attributes: [
        { name: "Name", type: "String", description: "Method name" }
      ]
    },
    {
      name: "IfStatement",
      description: "Represents an if statement",
      category: "Statement"
    }
  ]
};

const visualforceAstReference = {
  description: "Visualforce AST Node Reference",
  nodes: [
    {
      name: "ApexPage",
      description: "Root element of a Visualforce page",
      category: "Page"
    },
    {
      name: "OutputText",
      description: "Display text content",
      category: "Component"
    }
  ]
};

const htmlAstReference = {
  description: "HTML AST Node Reference",
  nodes: [
    {
      name: "HtmlDocument",
      description: "HTML document root",
      category: "Document"
    },
    {
      name: "Element",
      description: "HTML element",
      category: "Node"
    }
  ]
};

const javascriptAstReference = {
  description: "JavaScript AST Node Reference",
  nodes: [
    {
      name: "FunctionDeclaration",
      description: "JavaScript function",
      category: "Declaration"
    }
  ]
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("pmd-ast-reference", () => {
  describe("getAstNodeMetadataByNames", () => {
    it("loads apex ast reference", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify(apexAstReference));

      const { getAstNodeMetadataByNames } = await import("../../../src/ast/metadata/pmd-ast-reference.js");
      const result = await getAstNodeMetadataByNames("apex", ["ClassDeclaration"]);

      expect(mockReadFile).toHaveBeenCalledTimes(1);
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          href: expect.stringContaining("apex-ast-reference.json")
        }),
        "utf8"
      );
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("ClassDeclaration");
    });

    it("loads visualforce ast reference", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify(visualforceAstReference));

      const { getAstNodeMetadataByNames } = await import("../../../src/ast/metadata/pmd-ast-reference.js");
      const result = await getAstNodeMetadataByNames("visualforce", ["ApexPage"]);

      expect(mockReadFile).toHaveBeenCalledTimes(1);
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          href: expect.stringContaining("visualforce-ast-reference.json")
        }),
        "utf8"
      );
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("ApexPage");
    });

    it("loads html ast reference", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify(htmlAstReference));

      const { getAstNodeMetadataByNames } = await import("../../../src/ast/metadata/pmd-ast-reference.js");
      const result = await getAstNodeMetadataByNames("html", ["HtmlDocument"]);

      expect(mockReadFile).toHaveBeenCalledTimes(1);
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          href: expect.stringContaining("html-ast-reference.json")
        }),
        "utf8"
      );
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("HtmlDocument");
    });

    it("loads javascript ast reference", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify(javascriptAstReference));

      const { getAstNodeMetadataByNames } = await import("../../../src/ast/metadata/pmd-ast-reference.js");
      const result = await getAstNodeMetadataByNames("javascript", ["FunctionDeclaration"]);

      expect(mockReadFile).toHaveBeenCalledTimes(1);
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          href: expect.stringContaining("javascript-ast-reference.json")
        }),
        "utf8"
      );
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("FunctionDeclaration");
    });

    it("caches references per language", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify(apexAstReference));

      const { getAstNodeMetadataByNames } = await import("../../../src/ast/metadata/pmd-ast-reference.js");

      // First call - should read file
      await getAstNodeMetadataByNames("apex", ["ClassDeclaration"]);
      expect(mockReadFile).toHaveBeenCalledTimes(1);

      // Second call - should use cache, not read file again
      await getAstNodeMetadataByNames("apex", ["MethodDeclaration"]);
      expect(mockReadFile).toHaveBeenCalledTimes(1); // Still 1, not 2

      // Third call - same language, should still use cache
      await getAstNodeMetadataByNames("apex", ["IfStatement"]);
      expect(mockReadFile).toHaveBeenCalledTimes(1); // Still 1
    });

    it("normalizes language to lowercase", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify(apexAstReference));

      const { getAstNodeMetadataByNames } = await import("../../../src/ast/metadata/pmd-ast-reference.js");

      // Call with uppercase language
      const result = await getAstNodeMetadataByNames("APEX", ["ClassDeclaration"]);

      expect(mockReadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          href: expect.stringContaining("apex-ast-reference.json") // lowercase
        }),
        "utf8"
      );
      expect(result).toHaveLength(1);
    });

    it("trims whitespace from language", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify(apexAstReference));

      const { getAstNodeMetadataByNames } = await import("../../../src/ast/metadata/pmd-ast-reference.js");

      // Call with whitespace
      const result = await getAstNodeMetadataByNames("  apex  ", ["ClassDeclaration"]);

      expect(mockReadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          href: expect.stringContaining("apex-ast-reference.json")
        }),
        "utf8"
      );
      expect(result).toHaveLength(1);
    });

    it("throws error for unsupported language", async () => {
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT: no such file"));

      const { getAstNodeMetadataByNames } = await import("../../../src/ast/metadata/pmd-ast-reference.js");

      await expect(
        getAstNodeMetadataByNames("ruby", ["Class"])
      ).rejects.toThrow();
    });

    it("finds nodes by exact name match", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify(apexAstReference));

      const { getAstNodeMetadataByNames } = await import("../../../src/ast/metadata/pmd-ast-reference.js");
      const result = await getAstNodeMetadataByNames("apex", [
        "ClassDeclaration",
        "MethodDeclaration"
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("ClassDeclaration");
      expect(result[1].name).toBe("MethodDeclaration");
    });

    it("finds nodes by case-insensitive name match", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify(apexAstReference));

      const { getAstNodeMetadataByNames } = await import("../../../src/ast/metadata/pmd-ast-reference.js");
      const result = await getAstNodeMetadataByNames("apex", [
        "classdeclaration",  // lowercase
        "METHODDECLARATION"  // uppercase
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("ClassDeclaration");
      expect(result[1].name).toBe("MethodDeclaration");
    });

    it("preserves input order in results", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify(apexAstReference));

      const { getAstNodeMetadataByNames } = await import("../../../src/ast/metadata/pmd-ast-reference.js");
      const result = await getAstNodeMetadataByNames("apex", [
        "IfStatement",           // Third in reference
        "ClassDeclaration",      // First in reference
        "MethodDeclaration"      // Second in reference
      ]);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe("IfStatement");      // Preserved order
      expect(result[1].name).toBe("ClassDeclaration");
      expect(result[2].name).toBe("MethodDeclaration");
    });

    it("ignores unknown node names", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify(apexAstReference));

      const { getAstNodeMetadataByNames } = await import("../../../src/ast/metadata/pmd-ast-reference.js");
      const result = await getAstNodeMetadataByNames("apex", [
        "ClassDeclaration",
        "NonExistentNode",    // Unknown
        "MethodDeclaration",
        "AnotherFakeNode"     // Unknown
      ]);

      // Should return only the 2 valid nodes
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("ClassDeclaration");
      expect(result[1].name).toBe("MethodDeclaration");
    });

    it("returns empty array when all node names are unknown", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify(apexAstReference));

      const { getAstNodeMetadataByNames } = await import("../../../src/ast/metadata/pmd-ast-reference.js");
      const result = await getAstNodeMetadataByNames("apex", [
        "NonExistentNode",
        "AnotherFakeNode"
      ]);

      expect(result).toHaveLength(0);
    });

    it("returns empty array when node names array is empty", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify(apexAstReference));

      const { getAstNodeMetadataByNames } = await import("../../../src/ast/metadata/pmd-ast-reference.js");
      const result = await getAstNodeMetadataByNames("apex", []);

      expect(result).toHaveLength(0);
    });

    it("finds nodes by implements interface", async () => {
      const referenceWithInterfaces = {
        nodes: [
          {
            name: "StringLiteral",
            description: "String literal",
            implements: ["net.sourceforge.pmd.lang.ast.Node", "SomeInterface<Expression>"]
          },
          {
            name: "IntegerLiteral",
            description: "Integer literal",
            implements: ["net.sourceforge.pmd.lang.ast.Node", "AnotherInterface<Number>"]
          },
          {
            name: "BooleanLiteral",
            description: "Boolean literal",
            implements: ["net.sourceforge.pmd.lang.ast.Node"]
          }
        ]
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(referenceWithInterfaces));

      const { getAstNodeMetadataByNames } = await import("../../../src/ast/metadata/pmd-ast-reference.js");

      // Search by generic type parameter - looking for nodes with interfaces containing <expression>
      const result = await getAstNodeMetadataByNames("apex", ["expression"]);

      // Should find first node with <Expression> in its interface
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("StringLiteral");
      expect(result[0].implements).toContain("SomeInterface<Expression>");
    });

    it("handles nodes with attributes", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify(apexAstReference));

      const { getAstNodeMetadataByNames } = await import("../../../src/ast/metadata/pmd-ast-reference.js");
      const result = await getAstNodeMetadataByNames("apex", ["ClassDeclaration"]);

      expect(result).toHaveLength(1);
      expect(result[0].attributes).toBeDefined();
      expect(result[0].attributes).toHaveLength(1);
      expect(result[0].attributes![0].name).toBe("Name");
      expect(result[0].attributes![0].type).toBe("String");
    });

    it("handles nodes without attributes", async () => {
      mockReadFile.mockResolvedValueOnce(JSON.stringify(apexAstReference));

      const { getAstNodeMetadataByNames } = await import("../../../src/ast/metadata/pmd-ast-reference.js");
      const result = await getAstNodeMetadataByNames("apex", ["IfStatement"]);

      expect(result).toHaveLength(1);
      expect(result[0].attributes).toBeUndefined();
    });

    it("handles reference with metadata fields", async () => {
      const referenceWithMetadata = {
        description: "PMD AST Reference",
        source: "PMD 7.x",
        extraction_date: "2024-01-01",
        total_nodes: 3,
        version: "7.0.0",
        note: "Generated automatically",
        nodes: apexAstReference.nodes
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(referenceWithMetadata));

      const { getAstNodeMetadataByNames } = await import("../../../src/ast/metadata/pmd-ast-reference.js");
      const result = await getAstNodeMetadataByNames("apex", ["ClassDeclaration"]);

      // Should still work with metadata fields present
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("ClassDeclaration");
    });

    it("handles concurrent requests for different languages", async () => {
      mockReadFile
        .mockResolvedValueOnce(JSON.stringify(apexAstReference))
        .mockResolvedValueOnce(JSON.stringify(visualforceAstReference));

      const { getAstNodeMetadataByNames } = await import("../../../src/ast/metadata/pmd-ast-reference.js");

      // Make concurrent calls for different languages
      const [apexResult, vfResult] = await Promise.all([
        getAstNodeMetadataByNames("apex", ["ClassDeclaration"]),
        getAstNodeMetadataByNames("visualforce", ["ApexPage"])
      ]);

      expect(mockReadFile).toHaveBeenCalledTimes(2);
      expect(apexResult[0].name).toBe("ClassDeclaration");
      expect(vfResult[0].name).toBe("ApexPage");
    });

    it("handles concurrent requests for same language", async () => {
      // Reset modules to ensure fresh cache
      vi.resetModules();
      // Mock needs to handle multiple concurrent calls since caching happens after file read
      mockReadFile
        .mockResolvedValueOnce(JSON.stringify(apexAstReference))
        .mockResolvedValueOnce(JSON.stringify(apexAstReference));

      const { getAstNodeMetadataByNames } = await import("../../../src/ast/metadata/pmd-ast-reference.js");

      // Make concurrent calls for same language - both trigger before first completes
      // Note: Current implementation doesn't cache the promise, only the result
      // So both calls will attempt to read the file
      const promise1 = getAstNodeMetadataByNames("apex", ["ClassDeclaration"]);
      const promise2 = getAstNodeMetadataByNames("apex", ["MethodDeclaration"]);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both calls attempt to read file since cache is only set after read completes
      expect(mockReadFile).toHaveBeenCalledTimes(2);
      expect(result1[0].name).toBe("ClassDeclaration");
      expect(result2[0].name).toBe("MethodDeclaration");
    });
  });
});
