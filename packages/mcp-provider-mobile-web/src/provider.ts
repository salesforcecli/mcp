import { McpProvider, McpTool, Services } from "@salesforce/mcp-provider-api";
import { NativeCapabilityTool } from "./tools/native-capabilities/nativeCapabilityTool.js";
import { OfflineAnalysisTool } from "./tools/offline-analysis/sf-mobile-web-offline-analysis.js";
import { OfflineGuidanceTool } from "./tools/offline-guidance/sf-mobile-web-offline-guidance.js";
import { nativeCapabilityConfigs } from "./tools/native-capabilities/nativeCapabilityConfig.js";

/**
 * Example MCPProvider for demonstration puproses
 */
export class MobileWebMcpProvider extends McpProvider {
  // Must return a name for your McpProvider. It is recommended to make this match the class name
  public getName(): string {
    return "MobileWebMcpProvider";
  }

  // Must return a promise containing an array of the McpTool instances that you want to register
  public provideTools(services: Services): Promise<McpTool[]> {
    const telemetryService = services.getTelemetryService();
    const nativeCapabilityTools: NativeCapabilityTool[] = [];
    for (const config of nativeCapabilityConfigs) {
      nativeCapabilityTools.push(new NativeCapabilityTool(config, telemetryService));

    }
    
    return Promise.resolve([
      new OfflineAnalysisTool(telemetryService),
      new OfflineGuidanceTool(telemetryService),
      ...nativeCapabilityTools,
    ]);
  }

  // This ExampleMcpProvider does not implement provideResources or providePrompts since the
  // main MCP server doesn't consume them yet.
}
