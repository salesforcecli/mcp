import { McpToolConfig, ReleaseState, Toolset } from "@salesforce/mcp-provider-api";
import { SfDevopsListWorkItemsTool } from "../../src/tools/sf-devops-list-work-items.js";
import { ListWorkItemsActionImpl as _ListWorkItemsActionImpl } from "../../src/actions/list-work-items.js";
import { SpyTelemetryService } from "../test-doubles.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// Mock the action to avoid actual Salesforce API calls
class MockListWorkItemsAction {
  public async exec(_input: unknown) {
    return {
      workItems: [
        {
          id: "WI-001",
          name: "Test Work Item",
          status: "In Progress",
          owner: "test-user",
          DevopsProjectId: "project-123"
        }
      ],
      status: "success"
    };
  }
}

describe("Tests for SfDevopsListWorkItemsTool", () => {
  let telemetryService: SpyTelemetryService;
  let mockAction: MockListWorkItemsAction;
  let tool: SfDevopsListWorkItemsTool;

  beforeEach(() => {
    telemetryService = new SpyTelemetryService();
    mockAction = new MockListWorkItemsAction();
    tool = new SfDevopsListWorkItemsTool(mockAction as any);
  });

  it("When getReleaseState is called, then 'non-ga' is returned", () => {
    expect(tool.getReleaseState()).toEqual(ReleaseState.NON_GA);
  })

  it("When getToolsets is called, then 'other' is returned", () => {
    expect(tool.getToolsets()).toEqual([Toolset.OTHER]);
  });

  it("When getName is called, then 'sf-devops-list-work-items' is returned", () => {
    expect(tool.getName()).toEqual("sf-devops-list-work-items");
  });

  it("When getConfig is called, then the correct configuration is returned", () => {
    const config: McpToolConfig = tool.getConfig();
    expect(config.title).toEqual("List DevOps Work Items");
    expect(config.description).toContain("retrieves a list of work items");
    expect(config.inputSchema).toBeTypeOf("object");
    expect(Object.keys(config.inputSchema as object)).toEqual(["username", "project"]);
    expect(config.annotations).toEqual({ readOnlyHint: true });
  });

  describe("When exec is called...", () => {
    let result: CallToolResult;
    beforeEach(async () => {
      result = await tool.exec({ 
        username: "test@example.com", 
        project: { Id: "project-123", Name: "Test Project" }
      });
    });

    it("... then a valid result is returned", () => {
      expect(result).toHaveProperty("content");
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        type: "text",
        text: expect.stringContaining("WI-001"),
      });
    });

    it("... then the result contains work item data", () => {
      const content = result.content[0] as unknown;
      const workItems = JSON.parse((content as any).text);
      expect(workItems).toHaveLength(1);
      expect(workItems[0].id).toEqual("WI-001");
      expect(workItems[0].name).toEqual("Test Work Item");
    });
  });
});
