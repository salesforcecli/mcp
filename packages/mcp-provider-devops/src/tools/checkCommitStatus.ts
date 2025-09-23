import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, TelemetryService } from "@salesforce/mcp-provider-api";
import axios from "axios";
import { getConnection } from "../shared/auth.js";

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
      description: `Check the current status of a work item committed to DevOps Center.

        **Use this tool to:**
        - Check the status of a specific commit using its Request Id
        - Verify commit processing completion before creating a pull request
        - Ensure commits are ready for PR creation

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
      const connection = await getConnection(input.username);
      const query = `SELECT Id, Status__c, RequestToken__c FROM DevopsRequestInfo WHERE RequestToken__c = '${input.requestId}' LIMIT 1`;
      
      const response = await axios.get(`${connection.instanceUrl}/services/data/v60.0/query`, {
        headers: {
          'Authorization': `Bearer ${connection.accessToken}`,
          'Content-Type': 'application/json'
        },
        params: { q: query }
      });

      if (response.data.records && response.data.records.length > 0) {
        const record = response.data.records[0];
        const status = {
          requestId: input.requestId,
          status: record.Status__c,
          recordId: record.Id,
          message: `Request ${input.requestId} has status: ${record.Status__c}`
        };
        return {
          content: [{
            type: "text",
            text: JSON.stringify(status, null, 2)
          }]
        };
      } else {
        const status = {
          requestId: input.requestId,
          status: 'NOT_FOUND',
          message: `No record found for request ID: ${input.requestId}`
        };
        return {
          content: [{
            type: "text",
            text: JSON.stringify(status, null, 2)
          }]
        };
      }
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Failed to check commit status: ${error.message}`
        }],
        isError: true
      };
    }
  }
}
