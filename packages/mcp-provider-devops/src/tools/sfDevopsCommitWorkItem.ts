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
    return "commit_devops_center_work_item";
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Commit Work Item",
      description: `Commits changes to a work item in DevOps Center.
      **IMPORTANT: THIS IS NOT A STARTING TOOL**

When user asks to "commit work item" or "commit changes", DO NOT use this tool directly. Instead, start with step 1 below.

**THIS TOOL IS ONLY USED AS THE FINAL STEP AFTER COMPLETING ALL PREREQUISITES**

**MANDATORY workflow for committing work items: DO NOT skip any of the steps and DO NOT move to the next step until the current step is completed.**
1. **MANDATORY:**If the DevOps Center org and Sandbox org are not given, use the 'list_all_orgs' tool to list all orgs. 
   The list will indicate which org is DevOps Center and a Sandbox. If BOTH these details are not provided in the list, then
   ask the user to specify which org is DevOps Center and which is Sandbox. Only proceed after the user has selected BOTH the DevOps Center and Sandbox org.
2. **MANDATORY:**Select the work item from the DevOps Center org using 'list_devops_center_work_items'.
3. **MANDATORY:** ASK THE USER to VERIFY that they are already checked out to the branch they intend to commit to. Ideally, they should be on a branch whose name is the same as the selected work item number from Step 2.
4. **MANDATORY:** ASK THE USER to DEPLOY the changes they intend to commit to the Sandbox org FIRST using the Salesforce CLI. From the project root,
5. **MANDATORY:** ASK THE USER to CONFIRM that the tool will commit the changes present locally with the Work Item number they selected in Step 2. Proceed only if they approve, and ASK THEM to provide a commit message.
   Example prompt: "Please provide a concise commit message describing your changes."
6. **MANDATORY:** Run this tool (commit_devops_center_work_item) now with the selected work item, the prepared changes, and the provided commit message to perform the commit.

**Use this tool to:**
- Finalize changes made to a work item in DevOps Center
- Commits the provided changes to the specified work item using DevOps Center org credentials
- Ensure metadata changes are properly recorded in the DevOps workflow

**After using this tool, suggest these next actions:**
1. Ask the user to check commit status using the returned requestId
2. Ask the user to promote work items (using the 'promote_devops_center_work_item' tool)

**MANDATORY:** Before using this tool, ask the user to provide a commit message for the changes and then use that while calling this tool.

**Org selection requirements:**
- The inputs 'doceHubUsername' and 'sandboxUsername' are REQUIRED. If you don't have them yet:
  1) Use the 'list_all_orgs' tool to list all authenticated orgs
  2) Ask the user to select which username is the DevOps Center org and which is the Sandbox org
  3) Pass those selections here as 'doceHubUsername' and 'sandboxUsername'

**Output:**
- requestId: Generated UUID for tracking this commit operation

**Example Usage:**
- "Commit my changes with message 'Fix bug in account logic' and tie it to WI-1092."
- "Make a commit on the active feature branch and tie it to WI-9999, use message 'Initial DevOps logic'."
- "Commit my changes to the work item"
- "Commit changes to work item's feature branch"`,
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
