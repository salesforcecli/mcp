import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ScanApexAntipatternsTool } from "../../src/tools/scan-apex-antipatterns-tool.js";
import { StubServices, SpyTelemetryService } from "../test-doubles.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("ScanApexAntipatternsTool - Error Handling", () => {
  let tool: ScanApexAntipatternsTool;
  let services: StubServices;
  let telemetryService: SpyTelemetryService;
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    // Save original working directory
    originalCwd = process.cwd();
    services = new StubServices();
    telemetryService = services.telemetryService as SpyTelemetryService;
    tool = new ScanApexAntipatternsTool(services);
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "apex-error-test-"));
  });

  afterEach(() => {
    // Restore original working directory before cleanup to avoid Windows EPERM errors
    // The tool changes directory with process.chdir(), so we need to change back
    try {
      process.chdir(originalCwd);
    } catch (error) {
      // Ignore errors when changing back - directory might not exist anymore
    }
    
    // Clean up temporary directory
    // Note: On Windows, if files are still locked, cleanup may fail with EPERM.
    // temp directories will be cleaned up by the OS eventually.
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors - temp directory will be cleaned up by OS eventually
      }
    }
  });

  it("should handle Error exception in scan logic", async () => {
    // Create a spy on the antipatternRegistry to throw an error
    const testFilePath = path.join(tempDir, "TestClass.cls");
    fs.writeFileSync(testFilePath, "public class TestClass { }", "utf-8");

    // Monkey-patch the internal registry to throw an error
    const originalGetAllModules = (tool as any).antipatternRegistry.getAllModules;
    (tool as any).antipatternRegistry.getAllModules = () => {
      throw new Error("Simulated scan error");
    };

    const input = {
      className: "TestClass",
      apexFilePath: testFilePath,
      directory: tempDir,
    };

    const result = await tool.exec(input);

    // Restore original method
    (tool as any).antipatternRegistry.getAllModules = originalGetAllModules;

    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
    const text = (result.content[0] as any).text;
    expect(text).toContain("Error scanning class");
    expect(text).toContain("Simulated scan error");

    // Verify error telemetry was sent
    const errorEvents = telemetryService.sendEventCallHistory.filter(
      e => e.eventName === "scale_mcp_scan_apex_antipatterns_error"
    );
    expect(errorEvents.length).toBe(1);
    expect(errorEvents[0].event.error).toBe("Simulated scan error");
  });

  it("should handle non-Error exception in scan logic", async () => {
    // Create a test file
    const testFilePath = path.join(tempDir, "TestClass.cls");
    fs.writeFileSync(testFilePath, "public class TestClass { }", "utf-8");

    // Monkey-patch the internal registry to throw a non-Error
    const originalGetAllModules = (tool as any).antipatternRegistry.getAllModules;
    (tool as any).antipatternRegistry.getAllModules = () => {
      throw "String error"; // Throw a string instead of Error
    };

    const input = {
      className: "TestClass",
      apexFilePath: testFilePath,
      directory: tempDir,
    };

    const result = await tool.exec(input);

    // Restore original method
    (tool as any).antipatternRegistry.getAllModules = originalGetAllModules;

    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
    const text = (result.content[0] as any).text;
    expect(text).toContain("Error scanning class");
    expect(text).toContain("String error");

    // Verify error telemetry was sent with String(error)
    const errorEvents = telemetryService.sendEventCallHistory.filter(
      e => e.eventName === "scale_mcp_scan_apex_antipatterns_error"
    );
    expect(errorEvents.length).toBe(1);
    expect(errorEvents[0].event.error).toBe("String error");
  });

  it("should handle null exception", async () => {
    const testFilePath = path.join(tempDir, "TestClass.cls");
    fs.writeFileSync(testFilePath, "public class TestClass { }", "utf-8");

    const originalGetAllModules = (tool as any).antipatternRegistry.getAllModules;
    (tool as any).antipatternRegistry.getAllModules = () => {
      throw null; // Throw null
    };

    const input = {
      className: "TestClass",
      apexFilePath: testFilePath,
      directory: tempDir,
    };

    const result = await tool.exec(input);

    // Restore
    (tool as any).antipatternRegistry.getAllModules = originalGetAllModules;

    expect(result.isError).toBe(true);
    const text = (result.content[0] as any).text;
    expect(text).toContain("Error scanning class");
  });

  it("should handle undefined exception", async () => {
    const testFilePath = path.join(tempDir, "TestClass.cls");
    fs.writeFileSync(testFilePath, "public class TestClass { }", "utf-8");

    const originalGetAllModules = (tool as any).antipatternRegistry.getAllModules;
    (tool as any).antipatternRegistry.getAllModules = () => {
      throw undefined; // Throw undefined
    };

    const input = {
      className: "TestClass",
      apexFilePath: testFilePath,
      directory: tempDir,
    };

    const result = await tool.exec(input);

    // Restore
    (tool as any).antipatternRegistry.getAllModules = originalGetAllModules;

    expect(result.isError).toBe(true);
  });

  it("should handle object exception", async () => {
    const testFilePath = path.join(tempDir, "TestClass.cls");
    fs.writeFileSync(testFilePath, "public class TestClass { }", "utf-8");

    const originalGetAllModules = (tool as any).antipatternRegistry.getAllModules;
    (tool as any).antipatternRegistry.getAllModules = () => {
      throw { code: 500, message: "Custom error object" };
    };

    const input = {
      className: "TestClass",
      apexFilePath: testFilePath,
      directory: tempDir,
    };

    const result = await tool.exec(input);

    // Restore
    (tool as any).antipatternRegistry.getAllModules = originalGetAllModules;

    expect(result.isError).toBe(true);
    const text = (result.content[0] as any).text;
    expect(text).toContain("Error scanning class");
  });
});
