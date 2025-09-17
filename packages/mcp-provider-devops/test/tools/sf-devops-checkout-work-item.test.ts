import { SfDevopsCheckoutWorkItemMcpTool } from "../../src/tools/sf-devops-checkout-work-item.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { expect, it, describe, vi, beforeEach } from "vitest";

// Mock the dependencies
vi.mock("../../src/utils/checkoutWorkitemBranch.js", () => ({
  checkoutWorkitemBranch: vi.fn()
}));

vi.mock("../../src/utils/devops-operations.js", () => ({
  fetchWorkItemByName: vi.fn()
}));

describe("SfDevopsCheckoutWorkItemMcpTool", () => {
  let tool: SfDevopsCheckoutWorkItemMcpTool;

  beforeEach(() => {
    tool = new SfDevopsCheckoutWorkItemMcpTool();
    vi.clearAllMocks();
  });

  it("should have the correct name", () => {
    expect(tool.getName()).toEqual("sf-devops-checkout-work-item");
  });

  it("should have the correct title", () => {
    const config = tool.getConfig();
    expect(config.title).toEqual("Checkout DevOps Work Item Branch");
  });

  it("should not be marked as read-only", () => {
    const config = tool.getConfig();
    expect(config.annotations?.readOnlyHint).toBe(false);
  });

  it("should successfully checkout work item branch", async () => {
    const { fetchWorkItemByName } = await import("../../src/utils/devops-operations.js");
    const { checkoutWorkitemBranch } = await import("../../src/utils/checkoutWorkitemBranch.js");
    
    const mockWorkItem = {
      id: "wi1",
      name: "Test Work Item",
      status: "New",
      owner: "test-user",
      DevopsProjectId: "project1",
      SourceCodeRepository: { repoUrl: "https://github.com/test/repo", repoType: "github" },
      WorkItemBranch: "feature/wi-1"
    };
    
    const mockCheckoutResult = {
      content: [{ type: "text" as const, text: "Successfully checked out branch feature/wi-1" }]
    };
    
    vi.mocked(fetchWorkItemByName).mockResolvedValue(mockWorkItem);
    vi.mocked(checkoutWorkitemBranch).mockResolvedValue(mockCheckoutResult);

    const result: CallToolResult = await tool.exec({ 
      username: "test@example.com",
      workItemName: "Test Work Item",
      localPath: "/tmp/test"
    });
    
    expect(result.content[0].type).toEqual("text");
    const parsedContent = JSON.parse(result.content[0].text as string);
    expect(parsedContent.success).toBe(true);
    expect(parsedContent.path).toEqual("/tmp/test");
  });

  it("should handle missing work item", async () => {
    const { fetchWorkItemByName } = await import("../../src/utils/devops-operations.js");
    vi.mocked(fetchWorkItemByName).mockResolvedValue(null);

    const result: CallToolResult = await tool.exec({ 
      username: "test@example.com",
      workItemName: "Nonexistent Work Item"
    });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No Work Item found");
  });

  it("should handle missing repository URL", async () => {
    const { fetchWorkItemByName } = await import("../../src/utils/devops-operations.js");
    const mockWorkItem = {
      id: "wi1",
      name: "Test Work Item",
      status: "New",
      owner: "test-user",
      DevopsProjectId: "project1",
      WorkItemBranch: "feature/wi-1"
      // Missing SourceCodeRepository
    };
    
    vi.mocked(fetchWorkItemByName).mockResolvedValue(mockWorkItem);

    const result: CallToolResult = await tool.exec({ 
      username: "test@example.com",
      workItemName: "Test Work Item"
    });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Repository URL is missing");
  });
});
