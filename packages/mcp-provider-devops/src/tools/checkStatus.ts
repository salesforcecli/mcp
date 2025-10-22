import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, TelemetryService } from "@salesforce/mcp-provider-api";
import { fetchStatus } from "../getStatus.js";

const inputSchema = z.object({
  username: z.string().describe("Username of the DevOps Center org"),
  requestId: z.string().describe("Request ID from the DevOps Center operation to check status for")
});
type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class CheckStatus extends McpTool<InputArgsShape, OutputArgsShape> {
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
    return "check_devops_center_status";
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Check Status",
      description: `Check the current status of a DevOps Center operation.

        **Use when user asks (examples):**
        - "Check the status of this request id"
        - "Check the status of the commit with request id"
        - "Check the status of the promote with the request id"

        **Use this tool to:**
        - Check the status of a specific operation using its Request Id
        - Verify operation processing completion (commits, promotions, etc.)
        - Track the progress of DevOps Center operations

        **Input Parameters:**
        - username: The username of the DevOps Center org to authenticate with
        - requestId: The specific request Id to check status for (REQUIRED)

        **Output:**
        - Status field value for the specified request Id
        - Request Id and associated status information`,
      inputSchema: inputSchema.shape,
      outputSchema: undefined,
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    try {
      const status = await fetchStatus(input.username, input.requestId);
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
          text: `Failed to check status: ${error.message}`
        }],
        isError: true
      };
    }
  }
}
