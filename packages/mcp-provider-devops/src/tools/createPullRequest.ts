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
    return "create_devops_center_pull_request";
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Create Pull Request",
      description: `Commit local changes to a DevOps Center work item's feature branch
      
      **IMPORTANT: THIS IS NOT A STARTING TOOL**

      When user asks to "create pull request" or "create PR", DO NOT use this tool directly. Instead, start with step 1 below.

      **THIS TOOL IS ONLY USED AS THE FINAL STEP AFTER COMPLETING ALL PREREQUISITES**

      **MANDATORY workflow for creating pull requests: DO NOT skip any of the steps and DO NOT move to the next step until the current step is completed.**
      1. **MANDATORY:** If the DevOps Center org is not given, use the 'list_all_orgs' tool to list all orgs. 
            The list will indicate which org is DevOps Center. If this detail is not provided in the list, then
            ask the user to specify which org is DevOps Center. Only proceed after the user has selected the DevOps Center org.
      2. **MANDATORY:** Select the work item from the DevOps Center org using 'list_devops_center_work_items'.
      3. **MANDATORY:** Checkout the work item branch using 'checkout_devops_center_work_item' to get the project code locally.
      4. **MANDATORY:** Verify with the user that all changes have been manually committed and pushed to the work item branch. DO NOT use any commit tools - this should be done manually by the user.
      5. **MANDATORY - PREREQUISITE CHECK:** Ask the user for their commit request ID and use the 'check_devops_center_commit_status' tool to verify the status of their previous commits. You MUST call 'check_devops_center_commit_status' before proceeding. Do not skip this step.
      6. **MANDATORY:** Only after successfully verifying commit status with 'check_devops_center_commit_status', call this tool to create the pull request using the DevOps Center API.

      **Use this tool to:**
      - Create a Pull Request based on a work item in DevOps Center
      - Initiate the review process for completed work items
      - Move work items from development to review stage

      **After using this tool, suggest these next actions:**
      1. Ask the user to review the created pull request using the returned reviewUrl
      2. Ask the user to promote work items (using the 'promote_devops_center_work_item' tool) after PR approval

      **Output:**
      - reviewUrl: URL where the user can check the created pull request
      - status: Status of the pull request creation
      - workItemId: The work item ID for reference
      - errorMessage: Error message if the pull request creation failed

      **Example Usage:**
      - "Create a pull request for Work Item and merge it into integration"
      - "Open a PR from my current feature branch to the integration branch"
      - "Create and register a PR to DevOps Center from my latest pushed commits"
      - "Create a change request for my committed changes"
      - "Start the review process for my work item"`,
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
