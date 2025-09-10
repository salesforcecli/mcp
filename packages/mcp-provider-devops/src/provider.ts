import { McpProvider, McpTool, Services } from "@salesforce/mcp-provider-api";
import { DevOpsExampleTool } from "./tools/sf-devops-example-tool.js";

/**
 * MCP Provider for DevOps operations and tooling
 */
export class DevOpsMcpProvider extends McpProvider {
  // Must return a name for your McpProvider. It is recommended to make this match the class name
  public getName(): string {
    return "DevOpsMcpProvider";
  }

  // Must return a promise containing an array of the McpTool instances that you want to register
  public provideTools(services: Services): Promise<McpTool[]> {
    return Promise.resolve([
      new DevOpsExampleTool(services.getTelemetryService()),
    ]);
  }

  // This ExampleMcpProvider does not implement provideResources or providePrompts since the
  // main MCP server doesn't consume them yet.
}
