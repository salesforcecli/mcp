import { McpProvider, McpTool, Services } from "@salesforce/mcp-provider-api";
import { DevOpsMcpProvider } from "../src/provider.js";
import { StubServices } from "./test-doubles.js";

describe("Tests for DevOpsMcpProvider", () => {
  let services: Services;
  let provider: McpProvider;

  beforeEach(() => {
    services = new StubServices();
    provider = new DevOpsMcpProvider();
  });

  it("When getName is called, then 'DevOpsMcpProvider' is returned", () => {
    expect(provider.getName()).toEqual("DevOpsMcpProvider");
  });

  it("When provideTools is called, then the returned array contains all expected DevOps tools", async () => {
    const tools: McpTool[] = await provider.provideTools(services);
    expect(tools).toHaveLength(22); // 22 DevOps tools
    
    // Check that we have all the core tools
    const toolNames = tools.map(tool => tool.getName());
    expect(toolNames).toContain("sf-devops-list-orgs");
    expect(toolNames).toContain("sf-devops-list-projects");
    expect(toolNames).toContain("sf-devops-list-work-items");
    expect(toolNames).toContain("sf-devops-deploy-project-to-org");
  });
});
