import { McpProvider, McpTool, Services } from "@salesforce/mcp-provider-api";
import { DevOpsMcpProvider } from "../src/provider.js";
import { SfDevopsListProjectsMcpTool } from "../src/tools/sf-devops-list-projects.js";
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

  it("When provideTools is called, then the returned array contains the 10 tools from local_server.ts", async () => {
    const tools: McpTool[] = await provider.provideTools(services);
    expect(tools).toHaveLength(10);
    expect(tools[0]).toBeInstanceOf(SfDevopsListProjectsMcpTool);
    
    // Verify we have all expected tool types (in exact order from local_server.ts)
    const toolNames = tools.map(tool => tool.getName());
    const expectedTools = [
      'sf-devops-list-projects',        // registerSfDevopsListProjects
      'sf-devops-list-work-items',      // registerSfDevopsListWorkItems
      'sf-devops-create-pull-request',  // registerCreatePullRequest
      'sf-devops-detect-conflict',      // registerSfDevopsDetectConflict
      'sf-devops-resolve-conflict',     // registerSfDevopsResolveConflict
      'sf-devops-promote-work-item',    // registerSfDevopsPromoteWorkItem
      'sf-devopslist-orgs',             // registerSfDevopsListOrgs
      'sf-devops-commit-work-item',     // registerSfDevopsCommitWorkItem
      'sf-devops-check-commit-status',  // registerCheckCommitStatus
      'sf-devops-checkout-work-item'    // registerSfDevopsCheckoutWorkItem
    ];
    
    expectedTools.forEach((expectedTool, index) => {
      expect(toolNames[index]).toBe(expectedTool);
    });
  });
});
