import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { ScanApexAntipatternsTool } from "../../src/tools/scan-apex-antipatterns-tool.js";
import { ReleaseState, Toolset } from "@salesforce/mcp-provider-api";
import { SpyTelemetryService } from "../test-doubles.js";

describe("ScanApexAntipatternsTool", () => {
  let tool: ScanApexAntipatternsTool;
  let telemetryService: SpyTelemetryService;
  let tempDir: string;
  let testFilePath: string;

  // Helper function to create a test file
  const createTestFile = (fileName: string, content: string): string => {
    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, content, "utf-8");
    return filePath;
  };

  beforeEach(() => {
    telemetryService = new SpyTelemetryService();
    tool = new ScanApexAntipatternsTool(telemetryService);
    // Create a temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "apex-test-"));
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should have correct tool name", () => {
    expect(tool.getName()).toBe("scan_apex_class_for_antipatterns");
  });

  it("should return NON_GA release state", () => {
    expect(tool.getReleaseState()).toBe(ReleaseState.NON_GA);
  });

  it("should be in SCALE_PRODUCTS toolset", () => {
    const toolsets = tool.getToolsets();
    expect(toolsets).toContain(Toolset.SCALE_PRODUCTS);
  });

  it("should have proper configuration", () => {
    const config = tool.getConfig();
    
    expect(config.title).toContain("Scan Apex");
    expect(config.description).toContain("Analyzes");
    expect(config.description).toContain("antipattern");
    expect(config.inputSchema).toBeDefined();
  });

  it("should return ScanResult with grouped antipattern results", async () => {
    const apexCode = `
public class TestClass {
    public void testMethod() {
        Schema.SObjectType objType = Schema.getGlobalDescribe().get('Account');
    }
}`;
    testFilePath = createTestFile("TestClass.cls", apexCode);

    const input = {
      className: "TestClass",
      apexFilePath: testFilePath,
    };

    const result = await tool.exec(input);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    
    const text = (result.content[0] as any).text;
    
    // Verify response structure mentions
    expect(text).toContain("Antipattern Scan Results");
    expect(text).toContain("1 issue(s)");
    expect(text).toContain("GGD");
    
    // CRITICAL: Verify grouped structure in JSON
    expect(text).toContain("antipatternResults");
    expect(text).toContain("fixInstruction");
    expect(text).toContain("detectedInstances");
    expect(text).toContain("codeBefore");
  });

  it("should return no issues message when no antipatterns found", async () => {
    const apexCode = `
public class CleanClass {
    public void cleanMethod() {
        Account acc = new Account(Name = 'Test');
    }
}`;
    testFilePath = createTestFile("CleanClass.cls", apexCode);

    const input = {
      className: "CleanClass",
      apexFilePath: testFilePath,
    };

    const result = await tool.exec(input);
    const text = (result.content[0] as any).text;
    
    expect(text).toContain("No antipatterns detected");
    expect(text).toContain("CleanClass");
  });

  it("should handle multiple antipattern types (when available)", async () => {
    const apexCode = `
public class TestClass {
    public void method1() {
        Schema.getGlobalDescribe();
    }
    public void method2() {
        Schema.getGlobalDescribe();
    }
}`;
    testFilePath = createTestFile("TestClass.cls", apexCode);

    const input = {
      className: "TestClass",
      apexFilePath: testFilePath,
    };

    const result = await tool.exec(input);
    const text = (result.content[0] as any).text;
    
    // Should show multiple issues grouped under one type
    expect(text).toContain("2 issue(s)");
    expect(text).toContain("1 antipattern type");
  });

  it("should detect multiple instances and group them", async () => {
    const apexCode = `
public class TestClass {
    public void method1() {
        Schema.getGlobalDescribe();
    }
    public void method2() {
        for(String s : list) {
            Schema.getGlobalDescribe();
        }
    }
}`;
    testFilePath = createTestFile("TestClass.cls", apexCode);

    const input = {
      className: "TestClass",
      apexFilePath: testFilePath,
    };

    const result = await tool.exec(input);
    const text = (result.content[0] as any).text;
    
    expect(text).toContain("2 issue(s)");
    
    // Parse JSON to verify structure
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    expect(jsonMatch).toBeTruthy();
    
    const scanResult = JSON.parse(jsonMatch![1]);
    expect(scanResult.antipatternResults).toHaveLength(1);
    expect(scanResult.antipatternResults[0].detectedInstances).toHaveLength(2);
    expect(scanResult.antipatternResults[0].fixInstruction).toBeTruthy();
  });

  it("should handle errors gracefully", async () => {
    const apexCode = ""; // Empty code
    testFilePath = createTestFile("TestClass.cls", apexCode);

    const input = {
      className: "TestClass",
      apexFilePath: testFilePath,
    };

    const result = await tool.exec(input);
    
    // Empty code should just return no issues
    expect(result.content[0].type).toBe("text");
  });

  it("should include JSON scan result in output", async () => {
    const apexCode = `
public class TestClass {
    void m() { Schema.SObjectType t = Schema.getGlobalDescribe().get('Account'); }
}`;
    testFilePath = createTestFile("TestClass.cls", apexCode);

    const input = {
      className: "TestClass",
      apexFilePath: testFilePath,
    };

    const result = await tool.exec(input);
    const text = (result.content[0] as any).text;
    
    expect(text).toContain("```json");
    expect(text).toContain("antipatternResults");
    expect(text).toContain("className");
    expect(text).toContain("codeBefore");
    expect(text).toContain("fixInstruction");
  });

  it("should include LLM instructions in output", async () => {
    const apexCode = `
public class TestClass {
    void m() { Schema.getGlobalDescribe(); }
}`;
    testFilePath = createTestFile("TestClass.cls", apexCode);

    const input = {
      className: "TestClass",
      apexFilePath: testFilePath,
    };

    const result = await tool.exec(input);
    const text = (result.content[0] as any).text;
    
    expect(text).toContain("Instructions for LLM");
    expect(text).toContain("fixInstruction");
    expect(text).toContain("codeBefore");
    expect(text).toContain("severity");
  });

  it("should explain grouped structure in output", async () => {
    const apexCode = `
public class TestClass {
    void m() { Schema.getGlobalDescribe(); }
}`;
    testFilePath = createTestFile("TestClass.cls", apexCode);

    const input = {
      className: "TestClass",
      apexFilePath: testFilePath,
    };

    const result = await tool.exec(input);
    const text = (result.content[0] as any).text;
    
    expect(text).toContain("grouped by antipattern type");
    expect(text).toContain("applies to all instances");
  });

  it("should send telemetry events", async () => {
    const apexCode = `
public class TestClass {
    void m() { Schema.getGlobalDescribe(); }
}`;
    testFilePath = createTestFile("TestClass.cls", apexCode);

    const input = {
      className: "TestClass",
      apexFilePath: testFilePath,
    };

    await tool.exec(input);
    
    // Verify telemetry was sent
    expect(telemetryService.sendEventCallHistory.length).toBeGreaterThan(0);
    
    const eventNames = telemetryService.sendEventCallHistory.map(e => e.eventName);
    expect(eventNames).toContain("scan_apex_antipatterns_started");
    expect(eventNames).toContain("scan_apex_antipatterns_completed");
  });

  it("should return error when file does not exist", async () => {
    const input = {
      className: "TestClass",
      apexFilePath: path.join(tempDir, "NonExistent.cls"),
    };

    const result = await tool.exec(input);
    
    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
    const text = (result.content[0] as any).text;
    expect(text).toContain("File does not exist");
  });

  it("should return error when path is a directory", async () => {
    const subDir = path.join(tempDir, "subdir");
    fs.mkdirSync(subDir);

    const input = {
      className: "TestClass",
      apexFilePath: subDir,
    };

    const result = await tool.exec(input);
    
    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
    const text = (result.content[0] as any).text;
    expect(text).toContain("directory, not a file");
  });
});
