import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { RegexRuleStrategy } from "../../src/strategies/RegexRuleStrategy.js";
import { RuleCreationInput, ValidationResult, RuleCreationOutput } from "../../src/strategies/IRuleCreationStrategy.js";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

describe("RegexRuleStrategy tests", () => {
  let strategy: RegexRuleStrategy;
  let tempDir: string;

  beforeEach(async () => {
    strategy = new RegexRuleStrategy();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "regex-strategy-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("getSupportedEngine", () => {
    it("should return 'regex'", () => {
      expect(strategy.getSupportedEngine()).toBe("regex");
    });
  });

  describe("validate", () => {
    it("should pass validation with all required fields", () => {
      const input: RuleCreationInput = {
        engine: "regex",
        ruleName: "NoTodos",
        description: "Detects TODO comments",
        workingDirectory: tempDir,
        regex: "/todo/gi",
        violationMessage: "TODO found",
        tags: ["BestPractices"],
        severity: 3
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should fail validation when regex is missing", () => {
      const input: RuleCreationInput = {
        engine: "regex",
        ruleName: "NoTodos",
        description: "Detects TODO comments",
        workingDirectory: tempDir,
        violationMessage: "TODO found",
        tags: ["BestPractices"],
        severity: 3
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("regex is required for regex engine");
    });

    it("should fail validation when regex is empty string", () => {
      const input: RuleCreationInput = {
        engine: "regex",
        ruleName: "NoTodos",
        description: "Detects TODO comments",
        workingDirectory: tempDir,
        regex: "   ",
        violationMessage: "TODO found",
        tags: ["BestPractices"],
        severity: 3
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("regex is required for regex engine");
    });

    it("should fail validation when regex format is invalid (no slashes)", () => {
      const input: RuleCreationInput = {
        engine: "regex",
        ruleName: "NoTodos",
        description: "Detects TODO comments",
        workingDirectory: tempDir,
        regex: "todo",
        violationMessage: "TODO found",
        tags: ["BestPractices"],
        severity: 3
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("regex must be in format '/pattern/flags' (e.g., '/todo/gi')");
    });

    it("should fail validation when violationMessage is missing", () => {
      const input: RuleCreationInput = {
        engine: "regex",
        ruleName: "NoTodos",
        description: "Detects TODO comments",
        workingDirectory: tempDir,
        regex: "/todo/gi",
        tags: ["BestPractices"],
        severity: 3
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("violationMessage is required for regex engine");
    });

    it("should fail validation when violationMessage is empty string", () => {
      const input: RuleCreationInput = {
        engine: "regex",
        ruleName: "NoTodos",
        description: "Detects TODO comments",
        workingDirectory: tempDir,
        regex: "/todo/gi",
        violationMessage: "   ",
        tags: ["BestPractices"],
        severity: 3
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("violationMessage is required for regex engine");
    });

    it("should fail validation when tags is missing", () => {
      const input: RuleCreationInput = {
        engine: "regex",
        ruleName: "NoTodos",
        description: "Detects TODO comments",
        workingDirectory: tempDir,
        regex: "/todo/gi",
        violationMessage: "TODO found",
        severity: 3
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("tags is required for regex engine (provide at least one tag)");
    });

    it("should fail validation when tags is empty array", () => {
      const input: RuleCreationInput = {
        engine: "regex",
        ruleName: "NoTodos",
        description: "Detects TODO comments",
        workingDirectory: tempDir,
        regex: "/todo/gi",
        violationMessage: "TODO found",
        tags: [],
        severity: 3
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("tags is required for regex engine (provide at least one tag)");
    });

    it("should fail validation when severity is missing", () => {
      const input: RuleCreationInput = {
        engine: "regex",
        ruleName: "NoTodos",
        description: "Detects TODO comments",
        workingDirectory: tempDir,
        regex: "/todo/gi",
        violationMessage: "TODO found",
        tags: ["BestPractices"]
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("severity is required for regex engine");
    });

    it("should fail validation when severity is less than 1", () => {
      const input: RuleCreationInput = {
        engine: "regex",
        ruleName: "NoTodos",
        description: "Detects TODO comments",
        workingDirectory: tempDir,
        regex: "/todo/gi",
        violationMessage: "TODO found",
        tags: ["BestPractices"],
        severity: 0
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("severity must be between 1 (Critical) and 5 (Info)");
    });

    it("should fail validation when severity is greater than 5", () => {
      const input: RuleCreationInput = {
        engine: "regex",
        ruleName: "NoTodos",
        description: "Detects TODO comments",
        workingDirectory: tempDir,
        regex: "/todo/gi",
        violationMessage: "TODO found",
        tags: ["BestPractices"],
        severity: 6
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("severity must be between 1 (Critical) and 5 (Info)");
    });

    it("should fail validation when file extension does not start with dot", () => {
      const input: RuleCreationInput = {
        engine: "regex",
        ruleName: "NoTodos",
        description: "Detects TODO comments",
        workingDirectory: tempDir,
        regex: "/todo/gi",
        violationMessage: "TODO found",
        tags: ["BestPractices"],
        severity: 3,
        fileExtensions: ["cls", ".trigger"]
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("file extension must start with dot: 'cls' (use '.cls' not 'cls')");
    });

    it("should pass validation with valid file extensions", () => {
      const input: RuleCreationInput = {
        engine: "regex",
        ruleName: "NoTodos",
        description: "Detects TODO comments",
        workingDirectory: tempDir,
        regex: "/todo/gi",
        violationMessage: "TODO found",
        tags: ["BestPractices"],
        severity: 3,
        fileExtensions: [".cls", ".trigger"]
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should return multiple errors when multiple fields are invalid", () => {
      const input: RuleCreationInput = {
        engine: "regex",
        ruleName: "NoTodos",
        description: "Detects TODO comments",
        workingDirectory: tempDir,
        regex: "invalid",
        violationMessage: "",
        tags: [],
        severity: 10
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain("regex must be in format '/pattern/flags' (e.g., '/todo/gi')");
      expect(result.errors).toContain("violationMessage is required for regex engine");
      expect(result.errors).toContain("tags is required for regex engine (provide at least one tag)");
      expect(result.errors).toContain("severity must be between 1 (Critical) and 5 (Info)");
    });
  });

  describe("execute", () => {
    it("should create a regex rule successfully", async () => {
      const input: RuleCreationInput = {
        engine: "regex",
        ruleName: "NoTodos",
        description: "Detects TODO comments",
        workingDirectory: tempDir,
        regex: "/todo/gi",
        violationMessage: "TODO comment found",
        tags: ["BestPractices", "CodeQuality"],
        severity: 3
      };

      const result: RuleCreationOutput = await strategy.execute(input);

      expect(result.status).toBe("success");
      expect(result.configPath).toBeDefined();
      expect(result.ruleYaml).toBeDefined();
      expect(result.ruleYaml).toContain("NoTodos:");
      expect(result.ruleYaml).toContain('regex: "/todo/gi"');
      expect(result.ruleYaml).toContain('violation_message: "TODO comment found"');
      expect(result.ruleYaml).toContain('"BestPractices"');
      expect(result.ruleYaml).toContain('"CodeQuality"');
      expect(result.ruleYaml).toContain("severity: 3");
    });

    it("should create a regex rule with all optional fields", async () => {
      const input: RuleCreationInput = {
        engine: "regex",
        ruleName: "NoHardcodedIds",
        description: "Detects hardcoded IDs",
        workingDirectory: tempDir,
        regex: "/[a-zA-Z0-9]{15}/g",
        violationMessage: "Hardcoded ID found",
        tags: ["Security"],
        severity: 2,
        fileExtensions: [".cls", ".trigger"],
        regexIgnore: "/^000/",
        includeMetadata: true
      };

      const result: RuleCreationOutput = await strategy.execute(input);

      expect(result.status).toBe("success");
      expect(result.ruleYaml).toContain('regex_ignore: "/^000/"');
      expect(result.ruleYaml).toContain("file_extensions:");
      expect(result.ruleYaml).toContain('".cls"');
      expect(result.ruleYaml).toContain('".trigger"');
      expect(result.ruleYaml).toContain("include_metadata: true");
    });

    it("should create config file if it does not exist", async () => {
      const input: RuleCreationInput = {
        engine: "regex",
        ruleName: "NoTodos",
        description: "Detects TODO comments",
        workingDirectory: tempDir,
        regex: "/todo/gi",
        violationMessage: "TODO found",
        tags: ["BestPractices"],
        severity: 3
      };

      const result: RuleCreationOutput = await strategy.execute(input);

      expect(result.status).toBe("success");
      expect(result.configPath).toBeDefined();

      const configContent = await fs.readFile(result.configPath!, "utf8");
      expect(configContent).toContain("engines:");
      expect(configContent).toContain("regex:");
      expect(configContent).toContain("custom_rules:");
      expect(configContent).toContain("NoTodos:");
    });

    it("should add rule to existing config file", async () => {
      // Create initial config
      const configPath = path.join(tempDir, "code-analyzer.yml");
      const initialConfig = `engines:
  regex:
    custom_rules:
      ExistingRule:
        regex: "/test/g"
        description: "Test"
        violation_message: "Test violation"
        tags:
          - "Test"
        severity: 4
`;
      await fs.writeFile(configPath, initialConfig, "utf8");

      const input: RuleCreationInput = {
        engine: "regex",
        ruleName: "NoTodos",
        description: "Detects TODO comments",
        workingDirectory: tempDir,
        regex: "/todo/gi",
        violationMessage: "TODO found",
        tags: ["BestPractices"],
        severity: 3
      };

      const result: RuleCreationOutput = await strategy.execute(input);

      expect(result.status).toBe("success");

      const configContent = await fs.readFile(result.configPath!, "utf8");
      expect(configContent).toContain("ExistingRule:");
      expect(configContent).toContain("NoTodos:");
    });

    it("should throw error when working directory does not exist", async () => {
      const input: RuleCreationInput = {
        engine: "regex",
        ruleName: "TestRule",
        description: "Test",
        workingDirectory: "/nonexistent/path/that/does/not/exist",
        regex: "/test/g",
        violationMessage: "Test violation",
        tags: ["Test"],
        severity: 3
      };

      // Should throw an error when trying to write to nonexistent directory
      await expect(strategy.execute(input)).rejects.toThrow();
    });
  });
});
