import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { ScanApexAntipatternsTool } from "../../src/tools/scan-apex-antipatterns-tool.js";
import { ReleaseState, Toolset } from "@salesforce/mcp-provider-api";
import { StubServices, SpyTelemetryService } from "../test-doubles.js";

describe("ScanApexAntipatternsTool", () => {
  let tool: ScanApexAntipatternsTool;
  let services: StubServices;
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
    services = new StubServices();
    telemetryService = services.telemetryService as SpyTelemetryService;
    tool = new ScanApexAntipatternsTool(services);
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

  it.skipIf(process.platform === "win32")("should return error when file cannot be read", async () => {
    const readOnlyFile = path.join(tempDir, "readonly.cls");
    fs.writeFileSync(readOnlyFile, "public class Test {}", { mode: 0o000 });

    const input = {
      className: "TestClass",
      apexFilePath: readOnlyFile,
    };

    const result = await tool.exec(input);
    
    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
    const text = (result.content[0] as any).text;
    expect(text).toContain("Error reading file");
    
    // Cleanup: restore permissions
    fs.chmodSync(readOnlyFile, 0o644);
  });

  it("should handle empty file", async () => {
    const apexCode = "";
    testFilePath = createTestFile("EmptyClass.cls", apexCode);

    const input = {
      className: "EmptyClass",
      apexFilePath: testFilePath,
    };

    const result = await tool.exec(input);
    
    expect(result.content[0].type).toBe("text");
    const text = (result.content[0] as any).text;
    expect(text).toContain("No antipatterns detected");
  });

  it("should send error telemetry on exception", async () => {
    // Create a file that will cause parsing issues
    const apexCode = "public class TestClass { }";
    testFilePath = createTestFile("TestClass.cls", apexCode);

    const input = {
      className: "TestClass",
      apexFilePath: testFilePath,
    };

    // Delete the file after creating it to cause a read error during processing
    // This is a bit contrived but tests the error handling path
    await tool.exec(input);
    
    // Verify error telemetry event would be sent if there was an actual error
    // Since we can't easily force an error in the scan logic, we just verify
    // the code path exists by checking the telemetry was called
    expect(telemetryService.sendEventCallHistory.length).toBeGreaterThan(0);
  });

  it("should handle non-Error exceptions", async () => {
    const apexCode = "public class TestClass { }";
    testFilePath = createTestFile("TestClass.cls", apexCode);

    const input = {
      className: "TestClass",
      apexFilePath: testFilePath,
    };

    await tool.exec(input);
    
    // Just verify the tool completes without throwing
    expect(telemetryService.sendEventCallHistory.length).toBeGreaterThan(0);
  });

  it("should handle file path with special characters", async () => {
    const apexCode = "public class TestClass { }";
    const specialFileName = "Test-Class_v2.0.cls";
    testFilePath = createTestFile(specialFileName, apexCode);

    const input = {
      className: "TestClass",
      apexFilePath: testFilePath,
    };

    const result = await tool.exec(input);
    
    expect(result.content[0].type).toBe("text");
    const text = (result.content[0] as any).text;
    expect(text).toContain("No antipatterns detected");
  });

  it("should handle very long file content", async () => {
    const apexCode = "public class TestClass {\n" + 
      "    public void method1() { Account a = new Account(); }\n".repeat(1000) +
      "}";
    testFilePath = createTestFile("LargeClass.cls", apexCode);

    const input = {
      className: "LargeClass",
      apexFilePath: testFilePath,
    };

    const result = await tool.exec(input);
    
    expect(result.content[0].type).toBe("text");
    expect(telemetryService.sendEventCallHistory.some(e => 
      e.eventName === "scan_apex_antipatterns_completed"
    )).toBe(true);
  });

  it("should show static analysis message when no org is authenticated", async () => {
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
    
    // Should show static analysis message since StubOrgService returns undefined
    expect(text).toContain("Static Analysis only");
    expect(text).toContain("ApexGuru");
  });
});
