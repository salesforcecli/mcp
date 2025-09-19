import { McpProvider, McpTool, Services } from "@salesforce/mcp-provider-api";
import { ExampleMcpProvider } from "../src/provider.js";
import { ExampleMcpTool } from "../src/tools/example_tool.js";
import { StubServices } from "./test-doubles.js";

describe("Tests for ExampleMcpProvider", () => {
  let services: Services;
  let provider: McpProvider;

  beforeEach(() => {
    services = new StubServices();
    provider = new ExampleMcpProvider();
  });

  it("When getName is called, then 'ExampleMcpProvider' is returned", () => {
    expect(provider.getName()).toEqual("ExampleMcpProvider");
  });

  it("When provideTools is called, then the returned array contains an ExampleMcpTool instance", async () => {
    const tools: McpTool[] = await provider.provideTools(services);
    expect(tools).toHaveLength(1);
    expect(tools[0]).toBeInstanceOf(ExampleMcpTool);
  });
});
