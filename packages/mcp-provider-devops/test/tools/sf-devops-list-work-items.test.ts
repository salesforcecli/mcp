import { SfDevopsListWorkItemsMcpTool } from "../../src/tools/sf-devops-list-work-items.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { expect, it, describe, vi, beforeEach } from "vitest";

// Mock the devops operations
vi.mock("../../src/utils/devops-operations.js", () => ({
  fetchWorkItems: vi.fn()
}));

describe("SfDevopsListWorkItemsMcpTool", () => {
  let tool: SfDevopsListWorkItemsMcpTool;

  beforeEach(() => {
    tool = new SfDevopsListWorkItemsMcpTool();
    vi.clearAllMocks();
  });

  it("should have the correct name", () => {
    expect(tool.getName()).toEqual("sf-devops-list-work-items");
  });

  it("should have the correct title", () => {
    const config = tool.getConfig();
    expect(config.title).toEqual("List DevOps Center Work Items");
  });

  it("should be marked as read-only", () => {
    const config = tool.getConfig();
    expect(config.annotations?.readOnlyHint).toBe(true);
  });

  it("should return work items when exec is called", async () => {
    const { fetchWorkItems } = await import("../../src/utils/devops-operations.js");
    const mockWorkItems = [
      { 
        id: "wi1", 
        name: "Work Item 1", 
        status: "New", 
        owner: "user1",
        DevopsProjectId: "project1",
        WorkItemBranch: "feature/wi-1",
        TargetBranch: "main"
      },
      { 
        id: "wi2", 
        name: "Work Item 2", 
        status: "In Progress", 
        owner: "user2",
        DevopsProjectId: "project1",
        WorkItemBranch: "feature/wi-2",
        TargetBranch: "main"
      }
    ];
    
    vi.mocked(fetchWorkItems).mockResolvedValue(mockWorkItems);

    const result: CallToolResult = await tool.exec({ 
      username: "test@example.com",
      project: { Id: "project1", Name: "Test Project" }
    });
    
    expect(result.content[0].type).toEqual("text");
    const parsedContent = JSON.parse(result.content[0].text as string);
    expect(parsedContent.workItems).toHaveLength(2);
    expect(parsedContent.workItems[0].id).toEqual("wi1");
  });

  it("should handle errors gracefully", async () => {
    const { fetchWorkItems } = await import("../../src/utils/devops-operations.js");
    vi.mocked(fetchWorkItems).mockRejectedValue(new Error("Connection failed"));

    const result: CallToolResult = await tool.exec({ 
      username: "test@example.com",
      project: { Id: "project1" }
    });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error fetching work items");
  });
});
