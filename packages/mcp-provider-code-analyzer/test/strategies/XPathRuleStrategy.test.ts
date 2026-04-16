import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { XPathRuleStrategy } from "../../src/strategies/XPathRuleStrategy.js";
import { RuleCreationInput, ValidationResult, RuleCreationOutput } from "../../src/strategies/IRuleCreationStrategy.js";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

describe("XPathRuleStrategy tests", () => {
  let strategy: XPathRuleStrategy;
  let tempDir: string;

  beforeEach(async () => {
    strategy = new XPathRuleStrategy();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "xpath-strategy-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("getSupportedEngine", () => {
    it("should return 'pmd'", () => {
      expect(strategy.getSupportedEngine()).toBe("pmd");
    });
  });

  describe("validate", () => {
    it("should pass validation with all required fields", () => {
      const input: RuleCreationInput = {
        engine: "pmd",
        ruleName: "NoEmptyIfStatements",
        description: "Detects empty if statements",
        workingDirectory: tempDir,
        xpath: "//IfStatement[EmptyStatement]",
        language: "apex",
        priority: 3
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should fail validation when xpath is missing", () => {
      const input: RuleCreationInput = {
        engine: "pmd",
        ruleName: "NoEmptyIfStatements",
        description: "Detects empty if statements",
        workingDirectory: tempDir,
        language: "apex",
        priority: 3
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("xpath is required for PMD engine");
    });

    it("should fail validation when xpath is empty string", () => {
      const input: RuleCreationInput = {
        engine: "pmd",
        ruleName: "NoEmptyIfStatements",
        description: "Detects empty if statements",
        workingDirectory: tempDir,
        xpath: "   ",
        language: "apex",
        priority: 3
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("xpath is required for PMD engine");
    });

    it("should provide Apex-specific guidance when xpath is missing for Apex", () => {
      const input: RuleCreationInput = {
        engine: "pmd",
        ruleName: "NoEmptyIfStatements",
        description: "Detects empty if statements",
        workingDirectory: tempDir,
        language: "apex",
        priority: 3
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("get_ast_nodes_to_generate_xpath");
    });

    it("should provide Visualforce-specific guidance when xpath is missing for Visualforce", () => {
      const input: RuleCreationInput = {
        engine: "pmd",
        ruleName: "NoEmptyIfStatements",
        description: "Detects empty if statements",
        workingDirectory: tempDir,
        language: "visualforce",
        priority: 3
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("get_ast_nodes_to_generate_xpath");
    });

    it("should provide generic guidance when xpath is missing for other languages", () => {
      const input: RuleCreationInput = {
        engine: "pmd",
        ruleName: "NoEmptyIfStatements",
        description: "Detects empty if statements",
        workingDirectory: tempDir,
        language: "java",
        priority: 3
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("valid XPath expression");
      expect(result.errors[0]).not.toContain("get_ast_nodes_to_generate_xpath");
    });

    it("should fail validation when language is missing", () => {
      const input: RuleCreationInput = {
        engine: "pmd",
        ruleName: "NoEmptyIfStatements",
        description: "Detects empty if statements",
        workingDirectory: tempDir,
        xpath: "//IfStatement[EmptyStatement]",
        priority: 3
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("language is required for PMD engine (e.g., 'apex', 'visualforce')");
    });

    it("should fail validation when language is empty string", () => {
      const input: RuleCreationInput = {
        engine: "pmd",
        ruleName: "NoEmptyIfStatements",
        description: "Detects empty if statements",
        workingDirectory: tempDir,
        xpath: "//IfStatement[EmptyStatement]",
        language: "   ",
        priority: 3
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("language is required for PMD engine (e.g., 'apex', 'visualforce')");
    });

    it("should fail validation when priority is missing", () => {
      const input: RuleCreationInput = {
        engine: "pmd",
        ruleName: "NoEmptyIfStatements",
        description: "Detects empty if statements",
        workingDirectory: tempDir,
        xpath: "//IfStatement[EmptyStatement]",
        language: "apex"
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("priority is required for PMD engine (provide a value between 1 and 5)");
    });

    it("should fail validation when priority is less than 1", () => {
      const input: RuleCreationInput = {
        engine: "pmd",
        ruleName: "NoEmptyIfStatements",
        description: "Detects empty if statements",
        workingDirectory: tempDir,
        xpath: "//IfStatement[EmptyStatement]",
        language: "apex",
        priority: 0
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("priority must be between 1 and 5");
    });

    it("should fail validation when priority is greater than 5", () => {
      const input: RuleCreationInput = {
        engine: "pmd",
        ruleName: "NoEmptyIfStatements",
        description: "Detects empty if statements",
        workingDirectory: tempDir,
        xpath: "//IfStatement[EmptyStatement]",
        language: "apex",
        priority: 6
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("priority must be between 1 and 5");
    });

    it("should return multiple errors when multiple fields are invalid", () => {
      const input: RuleCreationInput = {
        engine: "pmd",
        ruleName: "NoEmptyIfStatements",
        description: "Detects empty if statements",
        workingDirectory: tempDir,
        priority: 10
      };

      const result: ValidationResult = strategy.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe("execute", () => {
    it("should create a PMD XPath rule successfully", async () => {
      const input: RuleCreationInput = {
        engine: "pmd",
        ruleName: "NoEmptyIfStatements",
        description: "Detects empty if statements",
        workingDirectory: tempDir,
        xpath: "//IfStatement[EmptyStatement]",
        language: "apex",
        priority: 3
      };

      const result: RuleCreationOutput = await strategy.execute(input);

      expect(result.status).toBe("success");
      expect(result.rulesetPath).toBeDefined();
      expect(result.configPath).toBeDefined();
      expect(result.ruleXml).toBeDefined();
      expect(result.ruleXml).toContain("NoEmptyIfStatements");
      expect(result.ruleXml).toContain("//IfStatement[EmptyStatement]");
      expect(result.ruleXml).toContain("apex");
      expect(result.ruleXml).toContain("<priority>3</priority>");
    });

    it("should create XML file in custom-rules directory", async () => {
      const input: RuleCreationInput = {
        engine: "pmd",
        ruleName: "NoEmptyIfStatements",
        description: "Detects empty if statements",
        workingDirectory: tempDir,
        xpath: "//IfStatement[EmptyStatement]",
        language: "apex",
        priority: 3
      };

      const result: RuleCreationOutput = await strategy.execute(input);

      expect(result.status).toBe("success");
      expect(result.rulesetPath).toContain("custom-rules");
      expect(result.rulesetPath).toContain("pmd-rules.xml");

      const xmlContent = await fs.readFile(result.rulesetPath!, "utf8");
      expect(xmlContent).toContain('<?xml version="1.0"?>');
      expect(xmlContent).toContain("<ruleset");
      expect(xmlContent).toContain("NoEmptyIfStatements");
    });

    it("should create config file if it does not exist", async () => {
      const input: RuleCreationInput = {
        engine: "pmd",
        ruleName: "NoEmptyIfStatements",
        description: "Detects empty if statements",
        workingDirectory: tempDir,
        xpath: "//IfStatement[EmptyStatement]",
        language: "apex",
        priority: 3
      };

      const result: RuleCreationOutput = await strategy.execute(input);

      expect(result.status).toBe("success");
      expect(result.configPath).toBeDefined();

      const configContent = await fs.readFile(result.configPath!, "utf8");
      expect(configContent).toContain("engines:");
      expect(configContent).toContain("pmd:");
      expect(configContent).toContain("custom_rulesets:");
    });

    it("should add ruleset reference to existing config file", async () => {
      // Create initial config
      const configPath = path.join(tempDir, "code-analyzer.yml");
      const initialConfig = `engines:
  pmd:
    custom_rulesets:
      - "custom-rules/existing-pmd-rules.xml"
`;
      await fs.writeFile(configPath, initialConfig, "utf8");

      const input: RuleCreationInput = {
        engine: "pmd",
        ruleName: "NoEmptyIfStatements",
        description: "Detects empty if statements",
        workingDirectory: tempDir,
        xpath: "//IfStatement[EmptyStatement]",
        language: "apex",
        priority: 3
      };

      const result: RuleCreationOutput = await strategy.execute(input);

      expect(result.status).toBe("success");

      const configContent = await fs.readFile(result.configPath!, "utf8");
      expect(configContent).toContain("existing-pmd-rules.xml");
      expect(configContent).toContain("noemptyifstatements-pmd-rules.xml");
    });
  });
});
