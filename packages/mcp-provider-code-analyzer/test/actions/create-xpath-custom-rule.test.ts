import { describe, expect, it, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "mcp-custom-rule-"));
}

async function cleanupTempDir(dir: string | undefined): Promise<void> {
  if (!dir) {
    return;
  }
  await fs.rm(dir, { recursive: true, force: true });
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("CreateXpathCustomRuleActionImpl", () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    await cleanupTempDir(tempDir);
    tempDir = undefined;
  });

  it("returns an error when xpath is missing", async () => {
    const { CreateXpathCustomRuleActionImpl } = await import("../../src/actions/create-xpath-custom-rule.js");
    const action = new CreateXpathCustomRuleActionImpl();
    const result = await action.exec({
      xpath: "",
      engine: "pmd",
      workingDirectory: "/tmp"
    });
    expect(result.status).toBe("xpath is required");
  });

  it("returns an error for unsupported engines", async () => {
    const { CreateXpathCustomRuleActionImpl } = await import("../../src/actions/create-xpath-custom-rule.js");
    const action = new CreateXpathCustomRuleActionImpl();
    const result = await action.exec({
      xpath: "//MethodCallExpression",
      engine: "eslint",
      workingDirectory: "/tmp"
    });
    expect(result.status).toBe("engine 'eslint' is not supported yet");
  });

  it("returns an error when workingDirectory is missing", async () => {
    const { CreateXpathCustomRuleActionImpl } = await import("../../src/actions/create-xpath-custom-rule.js");
    const action = new CreateXpathCustomRuleActionImpl();
    const result = await action.exec({
      xpath: "//MethodCallExpression",
      engine: "pmd",
      workingDirectory: "   "
    });
    expect(result.status).toBe("workingDirectory is required");
  });

  it("writes ruleset XML and config with a relative ruleset path", async () => {
    const { CreateXpathCustomRuleActionImpl } = await import("../../src/actions/create-xpath-custom-rule.js");
    const action = new CreateXpathCustomRuleActionImpl();
    tempDir = await createTempDir();

    const result = await action.exec({
      xpath: "//MethodCallExpression[@FullMethodName='System.debug']",
      ruleName: "My Rule",
      description: "No System.debug",
      language: "apex",
      engine: "pmd",
      priority: 2,
      workingDirectory: tempDir
    });

    expect(result.status).toBe("success");
    expect(result.rulesetPath).toBeTruthy();
    expect(result.configPath).toBeTruthy();

    const configContent = await fs.readFile(result.configPath as string, "utf8");
    expect(configContent).toContain('custom_rulesets:');
    expect(configContent).toContain('custom-rules/my-rule-pmd-rules.xml');
    expect(configContent).not.toContain(tempDir);
  });

  it("does not rewrite config when ruleset path already exists", async () => {
    const { CreateXpathCustomRuleActionImpl } = await import("../../src/actions/create-xpath-custom-rule.js");
    const action = new CreateXpathCustomRuleActionImpl();
    tempDir = await createTempDir();

    const configPath = path.join(tempDir, "code-analyzer.yml");
    await fs.writeFile(
      configPath,
      [
        "engines:",
        "  pmd:",
        "    custom_rulesets:",
        '      - "custom-rules/dup-rule-pmd-rules.xml"'
      ].join("\n"),
      "utf8"
    );

    const result = await action.exec({
      xpath: "//MethodCallExpression[@FullMethodName='System.debug']",
      ruleName: "Dup Rule",
      engine: "pmd",
      workingDirectory: tempDir
    });
    expect(result.status).toBe("success");

    const updated = await fs.readFile(configPath, "utf8");
    expect(countOccurrences(updated, 'custom-rules/dup-rule-pmd-rules.xml')).toBe(1);
  });

  it("adds a ruleset path to an existing config and avoids duplicates", async () => {
    const { CreateXpathCustomRuleActionImpl } = await import("../../src/actions/create-xpath-custom-rule.js");
    const action = new CreateXpathCustomRuleActionImpl();
    tempDir = await createTempDir();

    const configPath = path.join(tempDir, "code-analyzer.yml");
    await fs.writeFile(
      configPath,
      [
        "engines:",
        "  pmd:",
        "    custom_rulesets:",
        '      - "custom-rules/existing.xml"'
      ].join("\n"),
      "utf8"
    );

    const result = await action.exec({
      xpath: "//MethodCallExpression[@FullMethodName='System.debug']",
      ruleName: "Extra Rule",
      engine: "pmd",
      workingDirectory: tempDir
    });
    expect(result.status).toBe("success");

    const updated = await fs.readFile(configPath, "utf8");
    expect(updated).toContain('custom-rules/existing.xml');
    expect(updated).toContain('custom-rules/extra-rule-pmd-rules.xml');

    const count = countOccurrences(updated, 'custom-rules/extra-rule-pmd-rules.xml');
    expect(count).toBe(1);
  });

  it("appends an engine block when missing", async () => {
    const { CreateXpathCustomRuleActionImpl } = await import("../../src/actions/create-xpath-custom-rule.js");
    const action = new CreateXpathCustomRuleActionImpl();
    tempDir = await createTempDir();

    const configPath = path.join(tempDir, "code-analyzer.yml");
    await fs.writeFile(configPath, "version: 1\n", "utf8");

    const result = await action.exec({
      xpath: "//MethodCallExpression[@FullMethodName='System.debug']",
      ruleName: "Rule",
      engine: "pmd",
      workingDirectory: tempDir
    });
    expect(result.status).toBe("success");

    const updated = await fs.readFile(configPath, "utf8");
    expect(updated).toContain("engines:");
    expect(updated).toContain("  pmd:");
    expect(updated).toContain('custom_rulesets:');
    expect(updated).toContain('custom-rules/rule-pmd-rules.xml');
  });

  it("adds custom_rulesets under existing engine when missing", async () => {
    const { CreateXpathCustomRuleActionImpl } = await import("../../src/actions/create-xpath-custom-rule.js");
    const action = new CreateXpathCustomRuleActionImpl();
    tempDir = await createTempDir();

    const configPath = path.join(tempDir, "code-analyzer.yml");
    await fs.writeFile(
      configPath,
      [
        "engines:",
        "  pmd:",
        "    java_command: java"
      ].join("\n"),
      "utf8"
    );

    const result = await action.exec({
      xpath: "//MethodCallExpression[@FullMethodName='System.debug']",
      ruleName: "Inserted",
      engine: "pmd",
      workingDirectory: tempDir
    });
    expect(result.status).toBe("success");

    const updated = await fs.readFile(configPath, "utf8");
    expect(updated).toContain("  pmd:");
    expect(updated).toContain("    custom_rulesets:");
    expect(updated).toContain('custom-rules/inserted-pmd-rules.xml');
  });

  it("throws when config path is not readable", async () => {
    const { CreateXpathCustomRuleActionImpl } = await import("../../src/actions/create-xpath-custom-rule.js");
    const action = new CreateXpathCustomRuleActionImpl();
    tempDir = await createTempDir();

    const configPath = path.join(tempDir, "code-analyzer.yml");
    await fs.mkdir(configPath, { recursive: true });

    await expect(action.exec({
      xpath: "//MethodCallExpression[@FullMethodName='System.debug']",
      ruleName: "Unreadable",
      engine: "pmd",
      workingDirectory: tempDir
    })).rejects.toThrow();
  });
});
