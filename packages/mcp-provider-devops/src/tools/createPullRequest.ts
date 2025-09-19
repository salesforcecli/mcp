import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, TelemetryService } from "@salesforce/mcp-provider-api";
import { createPullRequest } from "../createPullRequest.js";
import { fetchWorkItemByName } from "../getWorkItems.js";

const inputSchema = z.object({
  workItemName: z.string().min(1).describe("Exact Work Item Name to create pull request."),
  username: z.string().describe("Username of the DevOps Center org to authenticate with")
});
type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class CreatePullRequest extends McpTool<InputArgsShape, OutputArgsShape> {
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
    return "create_pull_request";
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Create Pull Request",
      description: `Creates a pull request in a GitHub repository. Requires a GitHub token for authentication.`,
      inputSchema: inputSchema.shape,
      outputSchema: undefined,
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    try {
      const workItem = await fetchWorkItemByName(input.username, input.workItemName);
      
      if (!workItem || !workItem.id) {
        return {
          content: [{
            type: "text",
            text: `Error: Work item Name is required. Please provide a valid work item Name.`
          }]
        };
      }
      
      if (!input.username || input.username.trim().length === 0) {
        return {
          content: [{
            type: "text",
            text: `Error: Username is required. Please provide a valid DevOps Center org username.`
          }]
        };
      }

      const result = await createPullRequest({
        workItemId: workItem.id,
        username: input.username
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            workItemId: workItem.id,
            username: input.username,
            message: `Pull request created successfully for work item: ${workItem.id}`,
            pullRequestData: result.pullRequestResult
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error creating pull request: ${error.message}`
        }]
      };
    }
  }
}
