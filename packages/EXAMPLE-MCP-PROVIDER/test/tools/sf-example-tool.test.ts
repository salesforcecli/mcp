import { McpToolConfig, Toolset } from "@salesforce/mcp-provider-api";
import { ExampleMcpTool } from "../../src/tools/sf-example-tool";
import { SpyTelemetryService } from "../test-doubles";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

describe("Tests for ExampleMcpTool", () => {
  let telemetryService: SpyTelemetryService;
  let tool: ExampleMcpTool;

  beforeEach(() => {
    telemetryService = new SpyTelemetryService();
    tool = new ExampleMcpTool(telemetryService);
  });

  it("When getToolsets is called, then 'experimental' is returned", () => {
    expect(tool.getToolsets()).toEqual([Toolset.EXPERIMENTAL]);
  });

  it("When getName is called, then 'sf-example' is returned", () => {
    expect(tool.getName()).toEqual("sf-example");
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
