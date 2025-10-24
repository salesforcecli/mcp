import { McpProvider, McpTool, Services } from "@salesforce/mcp-provider-api";
import { ExampleMcpTool } from "./tools/example_tool.js";

/**
 * Example MCPProvider for demonstration puproses
 */
export class ExampleMcpProvider extends McpProvider {
  // Must return a name for your McpProvider. It is recommended to make this match the class name
  public getName(): string {
    return "ExampleMcpProvider";
  }

  // Must return a promise containing an array of the McpTool instances that you want to register
  public provideTools(services: Services): Promise<McpTool[]> {
    return Promise.resolve([
      new ExampleMcpTool(services.getTelemetryService()),
    ]);
  }

  // This ExampleMcpProvider does not implement provideResources or providePrompts since the
  // main MCP server doesn't consume them yet.
}
