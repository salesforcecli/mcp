import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, TelemetryService } from "@salesforce/mcp-provider-api";
import { commitWorkItem } from "../commitWorkItem.js";
import { fetchWorkItemByName } from "../getWorkItems.js";
import { normalizeAndValidateRepoPath } from "../shared/pathUtils.js";

const inputSchema = z.object({
  doceHubUsername: z.string().describe("DevOps Center org username (required; list orgs and select if unknown)"),
  sandboxUsername: z.string().describe("Sandbox org username (required; list orgs and select if unknown)"),
  workItemName: z.string().min(1).describe("Exact Work Item Name to commit workitem."),
  commitMessage: z.string().describe("Commit message describing the changes (ask user for input)"),
  repoPath: z.string().optional().describe("Optional: Absolute path to the git repository root. Defaults to current working directory.")
});
type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsCommitWorkItem extends McpTool<InputArgsShape, OutputArgsShape> {
  private readonly telemetryService: TelemetryService;

  constructor(telemetryService: TelemetryService) {
    super();
    this.telemetryService = telemetryService;
  }

  public getReleaseState(): ReleaseState {
    return ReleaseState.NON_GA;
  }

  public getToolsets(): Toolset[] {
    return [Toolset.DEVOPS];
  }

  public getName(): string {
    return "commit_workitem";
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Commit Work Item",
      description: `Commits changes to a work item in DevOps Center.`,
      inputSchema: inputSchema.shape,
      outputSchema: undefined,
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    try {
      const safeRepoPath = input.repoPath ? normalizeAndValidateRepoPath(input.repoPath) : undefined;

      const workItem = await fetchWorkItemByName(input.doceHubUsername, input.workItemName);
      
      if (!workItem) {
        return {
          content: [{
            type: "text",
            text: `Error: Work item Name is required. Please provide a work item with an Name.`
          }]
        };
      }

      if (!input.commitMessage || input.commitMessage.trim().length === 0) {
        return {
          content: [{
            type: "text",
            text: `Error: Commit message is required. Please provide a meaningful commit message describing your changes.`
          }]
        };
      }

      if (!input.doceHubUsername || !input.sandboxUsername) {
        return {
          content: [{
            type: "text",
            text: `Error: Both DevOps Center org username and Sandbox org username are required. Please provide both usernames.`
          }]
        };
      }

      const { randomUUID } = require('crypto');
      const requestId = randomUUID();
      
      const result = await commitWorkItem({
        doceHubUsername: input.doceHubUsername,
        sandboxUsername: input.sandboxUsername,
        workItem: workItem,
        requestId: requestId,
        commitMessage: input.commitMessage,
        repoPath: safeRepoPath
      });
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error committing work item: ${error.message}`
        }]
      };
    }
  }
}
