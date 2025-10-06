import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, TelemetryService } from "@salesforce/mcp-provider-api";
import { fetchCommitStatus } from "../getCommitStatus.js";

const inputSchema = z.object({
  username: z.string().describe("Username of the DevOps Center org"),
  requestId: z.string().describe("Request ID from the commit operation to check status for")
});
type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class CheckCommitStatus extends McpTool<InputArgsShape, OutputArgsShape> {
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
    return "check_devops_center_commit_status";
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Check Commit Status",
      description: `Checks the status of a specific commit by querying the "DevopsRequestInfo" Salesforce object using the RequestToken field.

**Use this tool to:**
- Check the status of a specific commit using its Request Token
- Verify commit processing completion before creating a pull request
- Ensure commits are ready for PR creation

**Input Parameters:**
- username: The username of the DevOps Center org to authenticate with
- requestId: The specific request token to check status for (REQUIRED)

**Output:**
- Status field value for the specified request token
- Request token and associated status information`,
      inputSchema: inputSchema.shape,
      outputSchema: undefined,
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    try {
      if (!input.username || input.username.trim().length === 0) {
        return {
          content: [{
            type: "text",
            text: `Error: Username is required. Please provide the DevOps Center org username.`
          }]
        };
      }

      if (!input.requestId || input.requestId.trim().length === 0) {
        return {
          content: [{
            type: "text",
            text: `Error: Request ID is required to check commit status.`
          }]
        };
      }

      const status = await fetchCommitStatus(input.username, input.requestId);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(status, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error checking commit status: ${error.message}`
        }],
        isError: true
      };
    }
  }
}
