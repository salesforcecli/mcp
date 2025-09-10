import { McpProvider, McpTool, Services } from "@salesforce/mcp-provider-api";
import { DevOpsMcpProvider } from "../src/provider.js";
import { DevOpsExampleTool } from "../src/tools/sf-devops-example-tool.js";
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

  it("When provideTools is called, then the returned array contains a DevOpsExampleTool instance", async () => {
    const tools: McpTool[] = await provider.provideTools(services);
    expect(tools).toHaveLength(1);
    expect(tools[0]).toBeInstanceOf(DevOpsExampleTool);
  });
});
