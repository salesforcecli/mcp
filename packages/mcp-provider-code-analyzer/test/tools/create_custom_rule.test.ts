import { describe, expect, it, vi } from "vitest";
import { CreateCustomRuleMcpTool } from "../../src/tools/create_custom_rule.js";
import { RuleCreationStrategyFactory } from "../../src/strategies/RuleCreationStrategyFactory.js";
import { IRuleCreationStrategy, RuleCreationInput, RuleCreationOutput, ValidationResult } from "../../src/strategies/IRuleCreationStrategy.js";

const strategyExecuteMock = vi.fn();
const strategyValidateMock = vi.fn();
const telemetrySendMock = vi.fn();

// Mock strategy
class MockStrategy implements IRuleCreationStrategy {
  getSupportedEngine(): string {
    return "pmd";
  }

  validate(_input: RuleCreationInput): ValidationResult {
    return strategyValidateMock();
  }

  async execute(input: RuleCreationInput): Promise<RuleCreationOutput> {
    return strategyExecuteMock(input);
  }
}

// Mock factory
class MockStrategyFactory extends RuleCreationStrategyFactory {
  private mockStrategy = new MockStrategy();

  createStrategy(engine: string): IRuleCreationStrategy {
    if (engine.toLowerCase() === "pmd" || engine.toLowerCase() === "regex" || engine.toLowerCase() === "eslint") {
      return this.mockStrategy;
    }
    return super.createStrategy(engine);
  }
}

function buildTool() {
  const mockFactory = new MockStrategyFactory();
  return new CreateCustomRuleMcpTool(
    mockFactory,
    {
      sendEvent: telemetrySendMock
    }
  );
}

describe("CreateCustomRuleMcpTool", () => {
  it("exposes the expected name and config", () => {
    const tool = buildTool();
    const config = tool.getConfig();

    expect(tool.getName()).toBe("create_custom_rule");
    expect(tool.getReleaseState()).toBe("non-ga");
    expect(tool.getToolsets()).toEqual(["code-analysis"]);
    expect(config.title).toBe("Create Custom Rule");
    expect(config.description).toContain("Purpose: Create a custom rule");
  });

  it("returns validation error when ruleName is missing", async () => {
    const tool = buildTool();
    const result = await tool.exec({
      xpath: "//MethodCallExpression",
      ruleName: "",
      description: "desc",
      language: "apex",
      engine: "pmd",
      priority: 3,
      workingDirectory: "/tmp"
    });

    expect(result.structuredContent?.status).toContain("ruleName is required");
    expect(strategyExecuteMock).not.toHaveBeenCalled();
  });

  it("returns validation error when description is missing", async () => {
    const tool = buildTool();
    const result = await tool.exec({
      xpath: "//MethodCallExpression",
      ruleName: "Rule",
      description: "   ",
      language: "apex",
      engine: "pmd",
      priority: 3,
      workingDirectory: "/tmp"
    });

    expect(result.structuredContent?.status).toContain("description is required");
    expect(strategyExecuteMock).not.toHaveBeenCalled();
  });

  it("returns validation error when language is missing for PMD", async () => {
    strategyValidateMock.mockReturnValueOnce({
      isValid: false,
      errors: ["language is required for PMD engine (e.g., 'apex', 'visualforce')"]
    });

    const tool = buildTool();
    const result = await tool.exec({
      xpath: "//MethodCallExpression",
      ruleName: "Rule",
      description: "desc",
      language: "   ",
      engine: "pmd",
      priority: 3,
      workingDirectory: "/tmp"
    });

    expect(result.structuredContent?.status).toContain("language is required");
    expect(strategyExecuteMock).not.toHaveBeenCalled();
  });

  it("returns validation error when engine is missing", async () => {
    const tool = buildTool();
    const result = await tool.exec({
      xpath: "//MethodCallExpression",
      ruleName: "Rule",
      description: "desc",
      language: "apex",
      engine: "   ",
      priority: 3,
      workingDirectory: "/tmp"
    });

    expect(result.structuredContent?.status).toContain("engine is required");
    expect(strategyExecuteMock).not.toHaveBeenCalled();
  });

  it("returns validation error when xpath is missing for PMD", async () => {
    strategyValidateMock.mockReturnValueOnce({
      isValid: false,
      errors: ["xpath is required for PMD engine. For Apex and Visualforce, use tool 'get_ast_nodes_to_generate_xpath' to generate the XPath."]
    });

    const tool = buildTool();
    const result = await tool.exec({
      xpath: "  ",
      ruleName: "Rule",
      description: "desc",
      language: "apex",
      engine: "pmd",
      priority: 3,
      workingDirectory: "/tmp"
    });

    expect(result.structuredContent?.status).toContain("xpath is required");
    expect(strategyExecuteMock).not.toHaveBeenCalled();
  });

  it("allows missing xpath for non-PMD engines", async () => {
    strategyValidateMock.mockReturnValueOnce({
      isValid: true,
      errors: []
    });
    strategyExecuteMock.mockResolvedValueOnce({
      status: "success",
      rulesetPath: "/tmp/custom.xml",
      configPath: "/tmp/code-analyzer.yml"
    });

    const tool = buildTool();
    await tool.exec({
      xpath: "   ",
      ruleName: "Rule",
      description: "desc",
      language: "apex",
      engine: "eslint",
      priority: 3,
      workingDirectory: "/tmp"
    });

    expect(strategyExecuteMock).toHaveBeenCalledTimes(1);
  });

  it("returns validation error when priority is missing for PMD", async () => {
    strategyValidateMock.mockReturnValueOnce({
      isValid: false,
      errors: ["priority is required for PMD engine (provide a value between 1 and 5)"]
    });

    const tool = buildTool();
    const result = await tool.exec({
      xpath: "//MethodCallExpression",
      ruleName: "Rule",
      description: "desc",
      language: "apex",
      engine: "pmd",
      priority: undefined,
      workingDirectory: "/tmp"
    } as unknown as Parameters<typeof tool.exec>[0]);

    expect(result.structuredContent?.status).toContain("priority is required");
    expect(strategyExecuteMock).not.toHaveBeenCalled();
  });

  it("returns validation error when workingDirectory is missing", async () => {
    const tool = buildTool();
    const result = await tool.exec({
      xpath: "//MethodCallExpression",
      ruleName: "Rule",
      description: "desc",
      language: "apex",
      engine: "pmd",
      priority: 3,
      workingDirectory: "   "
    });

    expect(result.structuredContent?.status).toContain("workingDirectory is required");
    expect(strategyExecuteMock).not.toHaveBeenCalled();
  });

  it("delegates to strategy and emits telemetry on success", async () => {
    strategyValidateMock.mockReturnValueOnce({
      isValid: true,
      errors: []
    });
    strategyExecuteMock.mockResolvedValueOnce({
      status: "success",
      rulesetPath: "/tmp/custom.xml",
      configPath: "/tmp/code-analyzer.yml"
    });

    const tool = buildTool();
    const result = await tool.exec({
      xpath: "//MethodCallExpression",
      ruleName: "Rule",
      description: "desc",
      language: "apex",
      engine: "pmd",
      priority: 3,
      workingDirectory: "/tmp"
    });

    expect(strategyExecuteMock).toHaveBeenCalledTimes(1);
    expect(result.content?.[0]?.text).toContain("Custom PMD rule created successfully");
    expect(telemetrySendMock).toHaveBeenCalledTimes(1);
  });

  it("does not emit telemetry on failure", async () => {
    strategyValidateMock.mockReturnValueOnce({
      isValid: true,
      errors: []
    });
    strategyExecuteMock.mockResolvedValueOnce({
      status: "something failed"
    });

    const tool = buildTool();
    const result = await tool.exec({
      xpath: "//MethodCallExpression",
      ruleName: "Rule",
      description: "desc",
      language: "apex",
      engine: "pmd",
      priority: 3,
      workingDirectory: "/tmp"
    });

    expect(result.content?.[0]?.text).toBe("something failed");
    expect(telemetrySendMock).not.toHaveBeenCalled();
  });
});
