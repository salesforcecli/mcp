import { describe, expect, it, vi, beforeEach } from "vitest";

const actionExecMock = vi.fn();
const telemetrySendMock = vi.fn();
const buildPromptMock = vi.fn();

vi.mock("../../src/engines/engine-strategies.js", () => ({
  getEngineStrategy: () => ({
    promptBuilder: {
      buildPrompt: buildPromptMock
    }
  })
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

async function buildTool(withTelemetry: boolean = true) {
  const { GenerateXpathPromptMcpTool } = await import("../../src/tools/generate_xpath_prompt.js");
  return new GenerateXpathPromptMcpTool(
    {
      exec: actionExecMock
    },
    withTelemetry
      ? { sendEvent: telemetrySendMock }
      : undefined
  );
}

describe("GenerateXpathPromptMcpTool", () => {
  it("returns validation error when language is missing", async () => {
    const tool = await buildTool();
    const result = await tool.exec({
      sampleCode: "class X {}",
      language: "  ",
      engine: "pmd"
    });

    expect(result.structuredContent?.status).toBe("language is required");
    expect(actionExecMock).not.toHaveBeenCalled();
  });

  it("returns validation error when engine is missing", async () => {
    const tool = await buildTool();
    const result = await tool.exec({
      sampleCode: "class X {}",
      language: "apex",
      engine: "  "
    });

    expect(result.structuredContent?.status).toBe("engine is required");
    expect(actionExecMock).not.toHaveBeenCalled();
  });

  it("returns validation error for unsupported engine", async () => {
    const tool = await buildTool();
    const result = await tool.exec({
      sampleCode: "class X {}",
      language: "apex",
      engine: "eslint"
    });

    expect(result.structuredContent?.status).toBe("engine 'eslint' is not supported yet");
    expect(actionExecMock).not.toHaveBeenCalled();
  });

  it("returns validation error when sample code is missing", async () => {
    const tool = await buildTool();
    const result = await tool.exec({
      sampleCode: "  ",
      language: "apex",
      engine: "pmd"
    });

    expect(result.structuredContent?.status).toBe("code in apex is required");
    expect(actionExecMock).not.toHaveBeenCalled();
  });

  it("returns error when AST action fails", async () => {
    actionExecMock.mockResolvedValueOnce({
      status: "failure",
      nodes: [],
      metadata: []
    });

    const tool = await buildTool();
    const result = await tool.exec({
      sampleCode: "class X {}",
      language: "apex",
      engine: "pmd"
    });

    expect(result.structuredContent?.status).toBe("failure");
    expect(result.structuredContent?.prompt).toBe("");
  });

  it("builds a prompt and emits telemetry on success", async () => {
    actionExecMock.mockResolvedValueOnce({
      status: "success",
      nodes: [{ nodeName: "CompilationUnit", attributes: {}, ancestors: [] }],
      metadata: []
    });
    buildPromptMock.mockReturnValueOnce("PROMPT");

    const tool = await buildTool();
    const result = await tool.exec({
      sampleCode: "class X {}",
      language: "apex",
      engine: "pmd"
    });

    expect(buildPromptMock).toHaveBeenCalledTimes(1);
    expect(result.structuredContent?.prompt).toBe("PROMPT");
    expect(telemetrySendMock).toHaveBeenCalledTimes(1);
  });

  it("does not emit telemetry when telemetry service is not provided", async () => {
    actionExecMock.mockResolvedValueOnce({
      status: "success",
      nodes: [],
      metadata: []
    });
    buildPromptMock.mockReturnValueOnce("PROMPT");

    const tool = await buildTool(false);
    await tool.exec({
      sampleCode: "class X {}",
      language: "apex",
      engine: "pmd"
    });

    expect(telemetrySendMock).not.toHaveBeenCalled();
  });

  it("exposes name, toolsets, release state, and config", async () => {
    const tool = await buildTool();
    const config = tool.getConfig();

    expect(tool.getName()).toBe("get_ast_nodes_to_generate_xpath");
    expect(tool.getReleaseState()).toBe("non-ga");
    expect(tool.getToolsets()).toEqual(["code-analysis"]);
    expect(config.title).toBe("Generate XPath Prompt");
    expect(config.description).toContain("First step for creating a PMD XPath-based custom rule");
  });
});
