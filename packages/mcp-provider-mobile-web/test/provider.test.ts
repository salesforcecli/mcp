import { McpProvider, McpTool, Services } from "@salesforce/mcp-provider-api";
import { MobileWebMcpProvider } from "../src/provider.js";
import { NativeCapabilityTool } from "../src/tools/native-capabilities/sf-mobile-native-capability.js";
import { OfflineAnalysisTool } from "../src/tools/offline-analysis/sf-mobile-web-offline-analysis.js";
import { OfflineGuidanceTool } from "../src/tools/offline-guidance/sf-mobile-web-offline-guidance.js";
import { StubServices } from "./test-doubles.js";

describe("Tests for MobileWebMcpProvider", () => {
  let services: Services;
  let provider: McpProvider;

  beforeEach(() => {
    services = new StubServices();
    provider = new MobileWebMcpProvider();
  });

  it("When getName is called, then 'MobileWebMcpProvider' is returned", () => {
    expect(provider.getName()).toEqual("MobileWebMcpProvider");
  });

  it("When provideTools is called, then the returned array contains the expected tools", async () => {
    const tools: McpTool[] = await provider.provideTools(services);
    expect(tools.length).toBeGreaterThan(0);
    
    // Check that we have the offline analysis and guidance tools
    const offlineAnalysisTools = tools.filter(tool => tool instanceof OfflineAnalysisTool);
    const offlineGuidanceTools = tools.filter(tool => tool instanceof OfflineGuidanceTool);
    const nativeCapabilityTools = tools.filter(tool => tool instanceof NativeCapabilityTool);
    
    expect(offlineAnalysisTools).toHaveLength(1);
    expect(offlineGuidanceTools).toHaveLength(1);
    expect(nativeCapabilityTools.length).toBeGreaterThan(0);
  });
});
