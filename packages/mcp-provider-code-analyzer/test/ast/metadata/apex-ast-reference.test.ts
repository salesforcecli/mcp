import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AstNodeMetadata } from "../../../src/ast/metadata/pmd-ast-reference.js";

// Mock the generic pmd-ast-reference module
const mockGetAstNodeMetadataByNames = vi.fn();
vi.mock("../../../src/ast/metadata/pmd-ast-reference.js", () => ({
  getAstNodeMetadataByNames: mockGetAstNodeMetadataByNames
}));

const sampleApexMetadata: AstNodeMetadata[] = [
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
    category: "Member"
  }
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("apex-ast-reference (backward compatibility)", () => {
  describe("getApexAstNodeMetadataByNames", () => {
    it("delegates to generic loader with 'apex' language", async () => {
      mockGetAstNodeMetadataByNames.mockResolvedValueOnce(sampleApexMetadata);

      const { getApexAstNodeMetadataByNames } = await import("../../../src/ast/metadata/apex-ast-reference.js");

      const nodeNames = ["ClassDeclaration", "MethodDeclaration"];
      const result = await getApexAstNodeMetadataByNames(nodeNames);

      // Verify it calls the generic loader with 'apex' language
      expect(mockGetAstNodeMetadataByNames).toHaveBeenCalledTimes(1);
      expect(mockGetAstNodeMetadataByNames).toHaveBeenCalledWith('apex', nodeNames);

      // Verify it returns the result from generic loader
      expect(result).toEqual(sampleApexMetadata);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("ClassDeclaration");
      expect(result[1].name).toBe("MethodDeclaration");
    });

    it("returns empty array when no nodes match", async () => {
      mockGetAstNodeMetadataByNames.mockResolvedValueOnce([]);

      const { getApexAstNodeMetadataByNames } = await import("../../../src/ast/metadata/apex-ast-reference.js");

      const result = await getApexAstNodeMetadataByNames(["NonExistentNode"]);

      expect(mockGetAstNodeMetadataByNames).toHaveBeenCalledWith('apex', ["NonExistentNode"]);
      expect(result).toEqual([]);
    });

    it("handles empty node names array", async () => {
      mockGetAstNodeMetadataByNames.mockResolvedValueOnce([]);

      const { getApexAstNodeMetadataByNames } = await import("../../../src/ast/metadata/apex-ast-reference.js");

      const result = await getApexAstNodeMetadataByNames([]);

      expect(mockGetAstNodeMetadataByNames).toHaveBeenCalledWith('apex', []);
      expect(result).toEqual([]);
    });

    it("preserves order of results from generic loader", async () => {
      const reversedMetadata = [...sampleApexMetadata].reverse();
      mockGetAstNodeMetadataByNames.mockResolvedValueOnce(reversedMetadata);

      const { getApexAstNodeMetadataByNames } = await import("../../../src/ast/metadata/apex-ast-reference.js");

      const result = await getApexAstNodeMetadataByNames(["MethodDeclaration", "ClassDeclaration"]);

      expect(result[0].name).toBe("MethodDeclaration");
      expect(result[1].name).toBe("ClassDeclaration");
    });

    it("propagates errors from generic loader", async () => {
      mockGetAstNodeMetadataByNames.mockRejectedValueOnce(new Error("File not found"));

      const { getApexAstNodeMetadataByNames } = await import("../../../src/ast/metadata/apex-ast-reference.js");

      await expect(
        getApexAstNodeMetadataByNames(["ClassDeclaration"])
      ).rejects.toThrow("File not found");
    });

    it("returns metadata with attributes", async () => {
      const metadataWithAttributes = [sampleApexMetadata[0]]; // ClassDeclaration with attributes
      mockGetAstNodeMetadataByNames.mockResolvedValueOnce(metadataWithAttributes);

      const { getApexAstNodeMetadataByNames } = await import("../../../src/ast/metadata/apex-ast-reference.js");

      const result = await getApexAstNodeMetadataByNames(["ClassDeclaration"]);

      expect(result[0].attributes).toBeDefined();
      expect(result[0].attributes).toHaveLength(1);
      expect(result[0].attributes![0].name).toBe("Name");
      expect(result[0].attributes![0].type).toBe("String");
    });

    it("type aliases are correctly exported", async () => {
      // This test verifies the type exports work at runtime
      // TypeScript compilation already validates the types
      const { getApexAstNodeMetadataByNames } = await import("../../../src/ast/metadata/apex-ast-reference.js");
      expect(typeof getApexAstNodeMetadataByNames).toBe("function");
    });
  });
});
