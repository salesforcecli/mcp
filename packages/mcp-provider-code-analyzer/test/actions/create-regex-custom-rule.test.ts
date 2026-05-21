import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import {
  CreateRegexCustomRuleActionImpl,
  CreateRegexCustomRuleInput,
  CreateRegexCustomRuleOutput
} from "../../src/actions/create-regex-custom-rule.js";

describe("CreateRegexCustomRuleAction tests", () => {
  let tempDir: string;
  let action: CreateRegexCustomRuleActionImpl;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "regex-rule-test-"));
    action = new CreateRegexCustomRuleActionImpl();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("should create a new config file with regex rule", async () => {
    const input: CreateRegexCustomRuleInput = {
      regex: "/todo/gi",
      ruleName: "NoTodos",
      description: "Detects TODO comments",
      violationMessage: "TODO comment found",
      tags: ["BestPractices"],
      severity: 3,
      workingDirectory: tempDir,
      engine: "regex"
    };

    const output: CreateRegexCustomRuleOutput = await action.exec(input);

    expect(output.status).toBe("success");
    expect(output.configPath).toBeDefined();
    expect(output.ruleYaml).toBeDefined();

    // Verify config file was created
    const configContent = await fs.readFile(output.configPath!, "utf8");
    expect(configContent).toContain("engines:");
    expect(configContent).toContain("regex:");
    expect(configContent).toContain("custom_rules:");
    expect(configContent).toContain("NoTodos:");
    expect(configContent).toContain('regex: "/todo/gi"');
    expect(configContent).toContain('description: "Detects TODO comments"');
    expect(configContent).toContain('violation_message: "TODO comment found"');
    expect(configContent).toContain('"BestPractices"');
    expect(configContent).toContain("severity: 3");
  });

  it("should create rule with all optional fields", async () => {
    const input: CreateRegexCustomRuleInput = {
      regex: "/[a-zA-Z0-9]{15,18}/g",
      ruleName: "NoHardcodedIds",
      description: "Detects hardcoded Salesforce IDs",
      violationMessage: "Hardcoded ID detected",
      tags: ["Security", "BestPractices"],
      severity: 2,
      fileExtensions: [".cls", ".trigger"],
      regexIgnore: "/^(000|001)/",
      includeMetadata: true,
      workingDirectory: tempDir,
      engine: "regex"
    };

    const output: CreateRegexCustomRuleOutput = await action.exec(input);

    expect(output.status).toBe("success");

    const configContent = await fs.readFile(output.configPath!, "utf8");
    expect(configContent).toContain('regex: "/[a-zA-Z0-9]{15,18}/g"');
    expect(configContent).toContain('regex_ignore: "/^(000|001)/"');
    expect(configContent).toContain('file_extensions:');
    expect(configContent).toContain('".cls"');
    expect(configContent).toContain('".trigger"');
    expect(configContent).toContain('"Security"');
    expect(configContent).toContain('"BestPractices"');
    expect(configContent).toContain("severity: 2");
    expect(configContent).toContain("include_metadata: true");
  });

  it("should add rule to existing config file", async () => {
    // Create initial config with one rule
    const configPath = path.join(tempDir, "code-analyzer.yml");
    const initialConfig = `engines:
  regex:
    custom_rules:
      ExistingRule:
        regex: "/test/g"
        description: "Existing rule"
        violation_message: "Test violation"
        tags:
          - "Test"
        severity: 4
`;
    await fs.writeFile(configPath, initialConfig, "utf8");

    const input: CreateRegexCustomRuleInput = {
      regex: "/fixme/gi",
      ruleName: "NoFixme",
      description: "Detects FIXME comments",
      violationMessage: "FIXME comment found",
      tags: ["CodeQuality"],
      severity: 3,
      workingDirectory: tempDir,
      engine: "regex"
    };

    const output: CreateRegexCustomRuleOutput = await action.exec(input);

    expect(output.status).toBe("success");

    const configContent = await fs.readFile(output.configPath!, "utf8");
    // Both rules should exist
    expect(configContent).toContain("ExistingRule:");
    expect(configContent).toContain("NoFixme:");
    expect(configContent).toContain('regex: "/test/g"');
    expect(configContent).toContain('regex: "/fixme/gi"');
  });

  it("should reject duplicate rule name", async () => {
    // Create initial config
    const input1: CreateRegexCustomRuleInput = {
      regex: "/todo/gi",
      ruleName: "NoTodos",
      description: "First todo rule",
      violationMessage: "TODO found",
      tags: ["Test"],
      severity: 3,
      workingDirectory: tempDir,
      engine: "regex"
    };

    await action.exec(input1);

    // Try to create rule with same name
    const input2: CreateRegexCustomRuleInput = {
      regex: "/fixme/gi",
      ruleName: "NoTodos", // Same name
      description: "Second rule",
      violationMessage: "FIXME found",
      tags: ["Test"],
      severity: 3,
      workingDirectory: tempDir,
      engine: "regex"
    };

    await expect(action.exec(input2)).rejects.toThrow(/already exists/);
  });

  it("should reject missing required fields", async () => {
    const input: CreateRegexCustomRuleInput = {
      regex: "", // Empty regex
      ruleName: "TestRule",
      description: "Test",
      violationMessage: "Test violation",
      tags: ["Test"],
      severity: 3,
      workingDirectory: tempDir,
      engine: "regex"
    };

    const output: CreateRegexCustomRuleOutput = await action.exec(input);

    expect(output.status).toContain("regex is required");
  });

  it("should reject invalid regex format", async () => {
    const input: CreateRegexCustomRuleInput = {
      regex: "todo", // Missing slashes and flags
      ruleName: "TestRule",
      description: "Test",
      violationMessage: "Test violation",
      tags: ["Test"],
      severity: 3,
      workingDirectory: tempDir,
      engine: "regex"
    };

    const output: CreateRegexCustomRuleOutput = await action.exec(input);

    expect(output.status).toContain("format");
  });

  it("should reject invalid severity", async () => {
    const input: CreateRegexCustomRuleInput = {
      regex: "/todo/gi",
      ruleName: "TestRule",
      description: "Test",
      violationMessage: "Test violation",
      tags: ["Test"],
      severity: 10, // Invalid: must be 1-5
      workingDirectory: tempDir,
      engine: "regex"
    };

    const output: CreateRegexCustomRuleOutput = await action.exec(input);

    expect(output.status).toContain("severity must be between 1");
  });

  it("should reject invalid file extension format", async () => {
    const input: CreateRegexCustomRuleInput = {
      regex: "/todo/gi",
      ruleName: "TestRule",
      description: "Test",
      violationMessage: "Test violation",
      tags: ["Test"],
      severity: 3,
      fileExtensions: ["cls"], // Missing dot
      workingDirectory: tempDir,
      engine: "regex"
    };

    const output: CreateRegexCustomRuleOutput = await action.exec(input);

    expect(output.status).toContain("must start with dot");
  });

  it("should handle existing config with other engines", async () => {
    // Create config with PMD rules
    const configPath = path.join(tempDir, "code-analyzer.yml");
    const initialConfig = `engines:
  pmd:
    custom_rulesets:
      - "custom-rules/my-pmd-rules.xml"

rules:
  pmd:
    WhileLoopsMustUseBraces:
      severity: HIGH
`;
    await fs.writeFile(configPath, initialConfig, "utf8");

    const input: CreateRegexCustomRuleInput = {
      regex: "/todo/gi",
      ruleName: "NoTodos",
      description: "Detects TODO comments",
      violationMessage: "TODO found",
      tags: ["CodeQuality"],
      severity: 3,
      workingDirectory: tempDir,
      engine: "regex"
    };

    const output: CreateRegexCustomRuleOutput = await action.exec(input);

    expect(output.status).toBe("success");

    const configContent = await fs.readFile(output.configPath!, "utf8");
    // Both engines should exist
    expect(configContent).toContain("pmd:");
    expect(configContent).toContain("regex:");
    expect(configContent).toContain("WhileLoopsMustUseBraces:");
    expect(configContent).toContain("NoTodos:");
  });
});
