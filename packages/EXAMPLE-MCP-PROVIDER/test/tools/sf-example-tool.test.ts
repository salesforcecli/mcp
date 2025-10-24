import { McpToolConfig, ReleaseState, Toolset } from "@salesforce/mcp-provider-api";
import { ExampleMcpTool } from "../../src/tools/example_tool.js";
import { SpyTelemetryService } from "../test-doubles.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

describe("Tests for ExampleMcpTool", () => {
  let telemetryService: SpyTelemetryService;
  let tool: ExampleMcpTool;

  beforeEach(() => {
    telemetryService = new SpyTelemetryService();
    tool = new ExampleMcpTool(telemetryService);
  });

  it("When getReleaseState is called, then 'non-ga' is returned", () => {
    expect(tool.getReleaseState()).toEqual(ReleaseState.NON_GA); // Make sure this truely reflects what you want
  })

  it("When getToolsets is called, then 'other' is returned", () => {
    expect(tool.getToolsets()).toEqual([Toolset.OTHER]);
  });

  it("When getName is called, then 'example_tool' is returned", () => {
    expect(tool.getName()).toEqual("example_tool");
  });

  it("When getConfig is called, then the correct configuration is returned", () => {
    const config: McpToolConfig = tool.getConfig();
    expect(config.title).toEqual("Example Tool");
    expect(config.description).toEqual("Example Description");
    expect(config.inputSchema).toBeTypeOf("object");
    expect(Object.keys(config.inputSchema as object)).toEqual(["someInput"]);
    expect(config.annotations).toEqual({ readOnlyHint: true });
  });

  describe("When exec is called...", () => {
    let result: CallToolResult;
    beforeEach(() => {
      result = tool.exec({ someInput: "someValue" });
    });

    it("... then telemetry is sent", () => {
      expect(telemetryService.sendEventCallHistory).toHaveLength(1);
      expect(telemetryService.sendEventCallHistory[0].eventName).toEqual(
        "sampleEvent"
      );
      expect(telemetryService.sendEventCallHistory[0].event).toEqual({
        someAttribute: "someAttributeValue",
      });
    });

    it("... then a valid result is returned", () => {
      expect(result).toHaveProperty("content");
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        type: "text",
        text: 'The input that was received: {"someInput":"someValue"}',
      });
    });
  });
});
