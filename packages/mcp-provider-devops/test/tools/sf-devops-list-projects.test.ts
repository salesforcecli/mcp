import { SfDevopsListProjectsMcpTool } from "../../src/tools/sf-devops-list-projects.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { expect, it, describe, vi, beforeEach } from "vitest";

// Mock the devops operations
vi.mock("../../src/utils/devops-operations.js", () => ({
  fetchProjects: vi.fn()
}));

describe("SfDevopsListProjectsMcpTool", () => {
  let tool: SfDevopsListProjectsMcpTool;

  beforeEach(() => {
    tool = new SfDevopsListProjectsMcpTool();
    vi.clearAllMocks();
  });

  it("should have the correct name", () => {
    expect(tool.getName()).toEqual("sf-devops-list-projects");
  });

  it("should have the correct title", () => {
    const config = tool.getConfig();
    expect(config.title).toEqual("List DevOps Center Projects");
  });

  it("should be marked as read-only", () => {
    const config = tool.getConfig();
    expect(config.annotations?.readOnlyHint).toBe(true);
  });

  it("should return projects when exec is called", async () => {
    const { fetchProjects } = await import("../../src/utils/devops-operations.js");
    const mockProjects = [
      { Id: "project1", Name: "Test Project 1", Description: "Test Description" },
      { Id: "project2", Name: "Test Project 2" }
    ];
    
    vi.mocked(fetchProjects).mockResolvedValue(mockProjects);

    const result: CallToolResult = await tool.exec({ username: "test@example.com" });
    
    expect(result.content[0].type).toEqual("text");
    const parsedContent = JSON.parse(result.content[0].text as string);
    expect(parsedContent.projects).toHaveLength(2);
    expect(parsedContent.projects[0].Id).toEqual("project1");
  });

  it("should handle errors gracefully", async () => {
    const { fetchProjects } = await import("../../src/utils/devops-operations.js");
    vi.mocked(fetchProjects).mockRejectedValue(new Error("Connection failed"));

    const result: CallToolResult = await tool.exec({ username: "test@example.com" });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error fetching projects");
  });
});
