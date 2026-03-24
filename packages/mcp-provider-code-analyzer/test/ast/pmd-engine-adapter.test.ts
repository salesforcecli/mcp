import { describe, expect, it, vi, beforeEach } from "vitest";
import path from "node:path";
import type { PmdEngine, PmdAstDumpResults } from "@salesforce/code-analyzer-pmd-engine";

// Mock node:fs/promises
const mockMkdtemp = vi.fn();
const mockWriteFile = vi.fn();
const mockRm = vi.fn();
vi.mock("node:fs/promises", () => ({
  default: {
    mkdtemp: mockMkdtemp,
    writeFile: mockWriteFile,
    rm: mockRm
  }
}));

// Mock node:os
const mockTmpdir = vi.fn();
vi.mock("node:os", () => ({
  default: {
    tmpdir: mockTmpdir
  }
}));

// Platform-independent paths
const TEMP_DIR = path.sep === "\\" ? "C:\\temp" : "/tmp";
const PMD_TEMP_DIR = path.join(TEMP_DIR, "pmd-ast-abc123");
const SOURCE_FILE_APEX = path.join(PMD_TEMP_DIR, "source.apex");

const successAstResult: PmdAstDumpResults = {
  file: SOURCE_FILE_APEX,
  ast: "<CompilationUnit>\n  <ClassDeclaration Name=\"Test\" />\n</CompilationUnit>",
  error: null
};

const errorResult: PmdAstDumpResults = {
  file: SOURCE_FILE_APEX,
  ast: null,
  error: {
    file: SOURCE_FILE_APEX,
    message: "Syntax error at line 1",
    detail: "Unexpected token"
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  mockTmpdir.mockReturnValue(TEMP_DIR);
  mockMkdtemp.mockResolvedValue(PMD_TEMP_DIR);
  mockWriteFile.mockResolvedValue(undefined);
  mockRm.mockResolvedValue(undefined);
});

describe("PmdEngineAstXmlAdapter", () => {
  describe("generateAstXml", () => {
    it("generates AST XML successfully", async () => {
      const mockPmdEngine = {
        generateAst: vi.fn().mockResolvedValue(successAstResult)
      } as unknown as PmdEngine;

      const { PmdEngineAstXmlAdapter } = await import("../../src/ast/pmd-engine-adapter.js");
      const adapter = new PmdEngineAstXmlAdapter(mockPmdEngine);

      const result = await adapter.generateAstXml("public class Test {}", "apex");

      expect(mockMkdtemp).toHaveBeenCalledWith(path.join(TEMP_DIR, "pmd-ast-"));
      expect(mockWriteFile).toHaveBeenCalledWith(
        SOURCE_FILE_APEX,
        "public class Test {}",
        "utf8"
      );
      expect(mockPmdEngine.generateAst).toHaveBeenCalledWith(
        "apex",
        SOURCE_FILE_APEX,
        {
          encoding: "UTF-8",
          workingFolder: PMD_TEMP_DIR
        }
      );
      expect(result).toBe("<CompilationUnit>\n  <ClassDeclaration Name=\"Test\" />\n</CompilationUnit>");
      expect(mockRm).toHaveBeenCalledWith(PMD_TEMP_DIR, { recursive: true, force: true });
    });

    it("throws error when PMD Engine returns error", async () => {
      const mockPmdEngine = {
        generateAst: vi.fn().mockResolvedValue(errorResult)
      } as unknown as PmdEngine;

      const { PmdEngineAstXmlAdapter } = await import("../../src/ast/pmd-engine-adapter.js");
      const adapter = new PmdEngineAstXmlAdapter(mockPmdEngine);

      await expect(
        adapter.generateAstXml("invalid code", "apex")
      ).rejects.toThrow("PMD Engine error: Syntax error at line 1");

      // Cleanup still happens
      expect(mockRm).toHaveBeenCalledWith(PMD_TEMP_DIR, { recursive: true, force: true });
    });

    it("throws error when PMD Engine returns no AST and no error", async () => {
      const mockPmdEngine = {
        generateAst: vi.fn().mockResolvedValue({
          file: SOURCE_FILE_APEX,
          ast: null,
          error: null
        })
      } as unknown as PmdEngine;

      const { PmdEngineAstXmlAdapter } = await import("../../src/ast/pmd-engine-adapter.js");
      const adapter = new PmdEngineAstXmlAdapter(mockPmdEngine);

      await expect(
        adapter.generateAstXml("class Test {}", "apex")
      ).rejects.toThrow("PMD Engine returned no AST and no error");

      expect(mockRm).toHaveBeenCalledWith(PMD_TEMP_DIR, { recursive: true, force: true });
    });

    it("cleans up temp directory even when exception occurs", async () => {
      mockWriteFile.mockRejectedValueOnce(new Error("Disk full"));

      const mockPmdEngine = {
        generateAst: vi.fn()
      } as unknown as PmdEngine;

      const { PmdEngineAstXmlAdapter } = await import("../../src/ast/pmd-engine-adapter.js");
      const adapter = new PmdEngineAstXmlAdapter(mockPmdEngine);

      await expect(
        adapter.generateAstXml("class Test {}", "apex")
      ).rejects.toThrow("Failed to generate AST XML via PMD Engine: Disk full");

      // Verify cleanup still happened despite error
      expect(mockRm).toHaveBeenCalledWith(PMD_TEMP_DIR, { recursive: true, force: true });
    });

    it("handles non-Error exceptions", async () => {
      mockWriteFile.mockRejectedValueOnce("string error");

      const mockPmdEngine = {
        generateAst: vi.fn()
      } as unknown as PmdEngine;

      const { PmdEngineAstXmlAdapter } = await import("../../src/ast/pmd-engine-adapter.js");
      const adapter = new PmdEngineAstXmlAdapter(mockPmdEngine);

      await expect(
        adapter.generateAstXml("class Test {}", "apex")
      ).rejects.toThrow("Failed to generate AST XML via PMD Engine: string error");

      expect(mockRm).toHaveBeenCalled();
    });

    it("trims AST output", async () => {
      const astWithWhitespace: PmdAstDumpResults = {
        file: SOURCE_FILE_APEX,
        ast: "\n\n  <CompilationUnit />  \n\n",
        error: null
      };

      const mockPmdEngine = {
        generateAst: vi.fn().mockResolvedValue(astWithWhitespace)
      } as unknown as PmdEngine;

      const { PmdEngineAstXmlAdapter } = await import("../../src/ast/pmd-engine-adapter.js");
      const adapter = new PmdEngineAstXmlAdapter(mockPmdEngine);

      const result = await adapter.generateAstXml("class Test {}", "apex");

      expect(result).toBe("<CompilationUnit />");
    });

    it("throws error for source exceeding max size", async () => {
      const largeCode = "x".repeat(1_000_001);

      const mockPmdEngine = {
        generateAst: vi.fn()
      } as unknown as PmdEngine;

      const { PmdEngineAstXmlAdapter } = await import("../../src/ast/pmd-engine-adapter.js");
      const adapter = new PmdEngineAstXmlAdapter(mockPmdEngine);

      await expect(
        adapter.generateAstXml(largeCode, "apex")
      ).rejects.toThrow("Source exceeds 1000000 bytes. Provide a smaller snippet.");

      // Should not create temp directory or call generateAst
      expect(mockMkdtemp).not.toHaveBeenCalled();
      expect(mockPmdEngine.generateAst).not.toHaveBeenCalled();
    });

    it("accepts source at max size boundary", async () => {
      const maxSizeCode = "x".repeat(1_000_000);

      const mockPmdEngine = {
        generateAst: vi.fn().mockResolvedValue(successAstResult)
      } as unknown as PmdEngine;

      const { PmdEngineAstXmlAdapter } = await import("../../src/ast/pmd-engine-adapter.js");
      const adapter = new PmdEngineAstXmlAdapter(mockPmdEngine);

      await adapter.generateAstXml(maxSizeCode, "apex");

      expect(mockMkdtemp).toHaveBeenCalled();
      expect(mockPmdEngine.generateAst).toHaveBeenCalled();
    });

    it("sanitizes file extension for apex", async () => {
      const mockPmdEngine = {
        generateAst: vi.fn().mockResolvedValue(successAstResult)
      } as unknown as PmdEngine;

      const { PmdEngineAstXmlAdapter } = await import("../../src/ast/pmd-engine-adapter.js");
      const adapter = new PmdEngineAstXmlAdapter(mockPmdEngine);

      await adapter.generateAstXml("class Test {}", "apex");

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining("source.apex"),
        expect.any(String),
        "utf8"
      );
    });

    it("sanitizes file extension for visualforce", async () => {
      const mockPmdEngine = {
        generateAst: vi.fn().mockResolvedValue(successAstResult)
      } as unknown as PmdEngine;

      const { PmdEngineAstXmlAdapter } = await import("../../src/ast/pmd-engine-adapter.js");
      const adapter = new PmdEngineAstXmlAdapter(mockPmdEngine);

      await adapter.generateAstXml("<apex:page />", "visualforce");

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining("source.visualforce"),
        expect.any(String),
        "utf8"
      );
    });

    it("sanitizes file extension with special characters", async () => {
      const mockPmdEngine = {
        generateAst: vi.fn().mockResolvedValue(successAstResult)
      } as unknown as PmdEngine;

      const { PmdEngineAstXmlAdapter } = await import("../../src/ast/pmd-engine-adapter.js");
      const adapter = new PmdEngineAstXmlAdapter(mockPmdEngine);

      await adapter.generateAstXml("class Test {}", "Java-Script!");

      // Special characters removed, lowercase
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining("source.javascript"),
        expect.any(String),
        "utf8"
      );
    });

    it("sanitizes empty language to txt extension", async () => {
      const mockPmdEngine = {
        generateAst: vi.fn().mockResolvedValue(successAstResult)
      } as unknown as PmdEngine;

      const { PmdEngineAstXmlAdapter } = await import("../../src/ast/pmd-engine-adapter.js");
      const adapter = new PmdEngineAstXmlAdapter(mockPmdEngine);

      await adapter.generateAstXml("code", "");

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining("source.txt"),
        expect.any(String),
        "utf8"
      );
    });

    it("normalizes apex language", async () => {
      const mockPmdEngine = {
        generateAst: vi.fn().mockResolvedValue(successAstResult)
      } as unknown as PmdEngine;

      const { PmdEngineAstXmlAdapter } = await import("../../src/ast/pmd-engine-adapter.js");
      const adapter = new PmdEngineAstXmlAdapter(mockPmdEngine);

      await adapter.generateAstXml("class Test {}", "APEX");

      expect(mockPmdEngine.generateAst).toHaveBeenCalledWith(
        "apex", // normalized to lowercase
        expect.any(String),
        expect.any(Object)
      );
    });

    it("normalizes vf to visualforce", async () => {
      const mockPmdEngine = {
        generateAst: vi.fn().mockResolvedValue(successAstResult)
      } as unknown as PmdEngine;

      const { PmdEngineAstXmlAdapter } = await import("../../src/ast/pmd-engine-adapter.js");
      const adapter = new PmdEngineAstXmlAdapter(mockPmdEngine);

      await adapter.generateAstXml("<apex:page />", "vf");

      expect(mockPmdEngine.generateAst).toHaveBeenCalledWith(
        "visualforce",
        expect.any(String),
        expect.any(Object)
      );
    });

    it("normalizes js to javascript", async () => {
      const mockPmdEngine = {
        generateAst: vi.fn().mockResolvedValue(successAstResult)
      } as unknown as PmdEngine;

      const { PmdEngineAstXmlAdapter } = await import("../../src/ast/pmd-engine-adapter.js");
      const adapter = new PmdEngineAstXmlAdapter(mockPmdEngine);

      await adapter.generateAstXml("function test() {}", "js");

      expect(mockPmdEngine.generateAst).toHaveBeenCalledWith(
        "javascript",
        expect.any(String),
        expect.any(Object)
      );
    });

    it("normalizes ecmascript to javascript", async () => {
      const mockPmdEngine = {
        generateAst: vi.fn().mockResolvedValue(successAstResult)
      } as unknown as PmdEngine;

      const { PmdEngineAstXmlAdapter } = await import("../../src/ast/pmd-engine-adapter.js");
      const adapter = new PmdEngineAstXmlAdapter(mockPmdEngine);

      await adapter.generateAstXml("function test() {}", "ecmascript");

      expect(mockPmdEngine.generateAst).toHaveBeenCalledWith(
        "javascript",
        expect.any(String),
        expect.any(Object)
      );
    });

    it("normalizes visualforce language", async () => {
      const mockPmdEngine = {
        generateAst: vi.fn().mockResolvedValue(successAstResult)
      } as unknown as PmdEngine;

      const { PmdEngineAstXmlAdapter } = await import("../../src/ast/pmd-engine-adapter.js");
      const adapter = new PmdEngineAstXmlAdapter(mockPmdEngine);

      await adapter.generateAstXml("<apex:page />", "VisualForce");

      expect(mockPmdEngine.generateAst).toHaveBeenCalledWith(
        "visualforce",
        expect.any(String),
        expect.any(Object)
      );
    });

    it("passes through unknown language", async () => {
      const mockPmdEngine = {
        generateAst: vi.fn().mockResolvedValue(successAstResult)
      } as unknown as PmdEngine;

      const { PmdEngineAstXmlAdapter } = await import("../../src/ast/pmd-engine-adapter.js");
      const adapter = new PmdEngineAstXmlAdapter(mockPmdEngine);

      await adapter.generateAstXml("code", "ruby");

      expect(mockPmdEngine.generateAst).toHaveBeenCalledWith(
        "ruby", // passed through as-is
        expect.any(String),
        expect.any(Object)
      );
    });

    it("trims whitespace from language before normalization", async () => {
      const mockPmdEngine = {
        generateAst: vi.fn().mockResolvedValue(successAstResult)
      } as unknown as PmdEngine;

      const { PmdEngineAstXmlAdapter } = await import("../../src/ast/pmd-engine-adapter.js");
      const adapter = new PmdEngineAstXmlAdapter(mockPmdEngine);

      await adapter.generateAstXml("class Test {}", "  apex  ");

      expect(mockPmdEngine.generateAst).toHaveBeenCalledWith(
        "apex",
        expect.any(String),
        expect.any(Object)
      );
    });

    it("handles xml language", async () => {
      const mockPmdEngine = {
        generateAst: vi.fn().mockResolvedValue(successAstResult)
      } as unknown as PmdEngine;

      const { PmdEngineAstXmlAdapter } = await import("../../src/ast/pmd-engine-adapter.js");
      const adapter = new PmdEngineAstXmlAdapter(mockPmdEngine);

      await adapter.generateAstXml("<root />", "xml");

      expect(mockPmdEngine.generateAst).toHaveBeenCalledWith(
        "xml",
        expect.any(String),
        expect.any(Object)
      );
    });

    it("handles html language", async () => {
      const mockPmdEngine = {
        generateAst: vi.fn().mockResolvedValue(successAstResult)
      } as unknown as PmdEngine;

      const { PmdEngineAstXmlAdapter } = await import("../../src/ast/pmd-engine-adapter.js");
      const adapter = new PmdEngineAstXmlAdapter(mockPmdEngine);

      await adapter.generateAstXml("<html></html>", "html");

      expect(mockPmdEngine.generateAst).toHaveBeenCalledWith(
        "html",
        expect.any(String),
        expect.any(Object)
      );
    });
  });
});
