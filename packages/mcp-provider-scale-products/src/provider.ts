import { McpProvider, McpTool, Services } from "@salesforce/mcp-provider-api";
import { ScanApexAntipatternsTool } from "./tools/scan-apex-antipatterns-tool.js";

/**
 * MCP Provider for Salesforce Scale Products
 * Provides tools for detecting and fixing Apex antipatterns
 */
export class ScaleProductsMcpProvider extends McpProvider {
  public getName(): string {
    return "ScaleProductsMcpProvider";
  }

  public provideTools(services: Services): Promise<McpTool[]> {
    return Promise.resolve([
      new ScanApexAntipatternsTool(services.getTelemetryService()),
    ]);
  }

  // This provider does not implement provideResources or providePrompts since the
  // main MCP server doesn't consume them yet.
}
