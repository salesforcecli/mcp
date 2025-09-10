import { McpToolConfig, ReleaseState, Toolset } from "@salesforce/mcp-provider-api";
import { DevOpsExampleTool } from "../../src/tools/sf-devops-example-tool.js";
import { SpyTelemetryService } from "../test-doubles.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

describe("Tests for DevOpsExampleTool", () => {
  let telemetryService: SpyTelemetryService;
  let tool: DevOpsExampleTool;

  beforeEach(() => {
    telemetryService = new SpyTelemetryService();
    tool = new DevOpsExampleTool(telemetryService);
  });

  it("When getReleaseState is called, then 'non-ga' is returned", () => {
    expect(tool.getReleaseState()).toEqual(ReleaseState.NON_GA); // Make sure this truely reflects what you want
  })

  it("When getToolsets is called, then 'other' is returned", () => {
    expect(tool.getToolsets()).toEqual([Toolset.OTHER]);
  });

  it("When getName is called, then 'sf-devops-example' is returned", () => {
    expect(tool.getName()).toEqual("sf-devops-example");
  });

  it("When getConfig is called, then the correct configuration is returned", () => {
    const config: McpToolConfig = tool.getConfig();
    expect(config.title).toEqual("DevOps Example Tool");
    expect(config.description).toEqual("Example DevOps tool for demonstration purposes");
    expect(config.inputSchema).toBeTypeOf("object");
    expect(Object.keys(config.inputSchema as object)).toEqual(["operation"]);
    expect(config.annotations).toEqual({ readOnlyHint: true });
  });

  describe("When exec is called...", () => {
    let result: CallToolResult;
    beforeEach(() => {
      result = tool.exec({ operation: "deploy" });
    });

    it("... then telemetry is sent", () => {
      expect(telemetryService.sendEventCallHistory).toHaveLength(1);
      expect(telemetryService.sendEventCallHistory[0].eventName).toEqual(
        "devOpsOperationEvent"
      );
      expect(telemetryService.sendEventCallHistory[0].event).toEqual({
        operation: "deploy",
      });
    });

    it("... then a valid result is returned", () => {
      expect(result).toHaveProperty("content");
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        type: "text",
        text: "DevOps operation requested: deploy. This is an example tool for demonstration purposes.",
      });
    });
  });
});
