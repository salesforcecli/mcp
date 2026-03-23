import { describe, expect, it, vi } from "vitest";
import { CreateCustomRuleMcpTool } from "../../src/tools/create_custom_rule.js";

const actionExecMock = vi.fn();
const telemetrySendMock = vi.fn();

function buildTool() {
  return new CreateCustomRuleMcpTool(
    {
      exec: actionExecMock
    },
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
    expect(actionExecMock).not.toHaveBeenCalled();
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
    expect(actionExecMock).not.toHaveBeenCalled();
  });

  it("returns validation error when language is missing", async () => {
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
    expect(actionExecMock).not.toHaveBeenCalled();
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
    expect(actionExecMock).not.toHaveBeenCalled();
  });

  it("returns validation error when xpath is missing for PMD", async () => {
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

    expect(result.structuredContent?.status).toContain("xpath is required for engine 'pmd'");
    expect(actionExecMock).not.toHaveBeenCalled();
  });

  it("allows missing xpath for non-PMD engines", async () => {
    actionExecMock.mockResolvedValueOnce({
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

    expect(actionExecMock).toHaveBeenCalledTimes(1);
  });

  it("returns validation error when priority is missing", async () => {
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
    expect(actionExecMock).not.toHaveBeenCalled();
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
    expect(actionExecMock).not.toHaveBeenCalled();
  });

  it("delegates to action and emits telemetry on success", async () => {
    actionExecMock.mockResolvedValueOnce({
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

    expect(actionExecMock).toHaveBeenCalledTimes(1);
    expect(result.content?.[0]?.text).toContain("Custom rule created");
    expect(telemetrySendMock).toHaveBeenCalledTimes(1);
  });

  it("does not emit telemetry on failure", async () => {
    actionExecMock.mockResolvedValueOnce({
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
