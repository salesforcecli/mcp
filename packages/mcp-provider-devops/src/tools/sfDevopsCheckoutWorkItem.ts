import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, TelemetryService } from "@salesforce/mcp-provider-api";
import { checkoutWorkitemBranch } from "../checkoutWorkitemBranch.js";
import { fetchWorkItemByName } from "../getWorkItems.js";
import { normalizeAndValidateRepoPath } from "../shared/pathUtils.js";

const inputSchema = z.object({
  username: z.string().describe("The username of the DevOps Center org."),
  workItemName: z.string().min(1).describe("Exact Work Item Name to check out."),
  localPath: z.string().describe("The directory path where the repository should be cloned/checked out. If not provided, ask user to provide the path where project is cloned.")
});
type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsCheckoutWorkItem extends McpTool<InputArgsShape, OutputArgsShape> {
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
    return "checkout_devops_center_work_item";
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Checkout Work Item",
      description: `Checks out the branch associated with a selected work item by name.

**MANDATORY:** Always ask the user to provide the local path (repoPath) to the checked-out repository. 
You may show the current working directory as an option, but do not proceed until the user has explicitly chosen a repo path. 
Never assume or default to a path without user confirmation.

This tool takes the DevOps Center org username and the exact Work Item Name, looks up the Work Item to retrieve its repository URL and branch, and then checks out that branch. If localPath is not provided, the current working directory will be used. It clones the repository to the specified local path if it does not exist there, and checks out the specified branch. Assumes the user is already authenticated with the git CLI.

**How to use this tool:**

1. **Work Item Name Required:**
   - Provide the exact Work Item Name and the DevOps Center org username. The tool will fetch the Work Item and derive repo URL and branch automatically.

2. **Input Parameters:**
   - "username": The username of the DevOps Center org.
   - "workItemName": The exact Name of the Work Item whose branch to check out.
   - "localPath" (mandatory): The directory path where the repository should be cloned/checked out. Must be provided by the user. The current working directory can be shown as an option, but do not proceed until the user chooses.

3. **Operation:**
   - If the repository does not exist at the specified local path, the tool will clone it there.
   - The tool will then check out the specified branch in that directory.
   - The output will explicitly show the path where the repository is cloned.

**Typical workflow:**
- Provide Work Item Name and local path, then run this tool to clone and check out the correct branch.

**Output:**
- Success or error message indicating the result of the clone and checkout operations, including the path where the repository is cloned.`,
      inputSchema: inputSchema.shape,
      outputSchema: undefined,
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    let safeLocalPath: string | undefined = undefined;
    try {
      if (!input.localPath || input.localPath.trim().length === 0) {
        return {
          content: [{
            type: "text",
            text: `Error: Repository path is required. Please provide the absolute path to the git repository root.`
          }]
        };
      }

      safeLocalPath = input.localPath ? normalizeAndValidateRepoPath(input.localPath) : undefined;
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `Invalid localPath: ${e?.message || e}` }]
      };
    }

    const workItem = await fetchWorkItemByName(input.username, input.workItemName);
    
    if (!workItem?.SourceCodeRepository?.repoUrl || !workItem?.WorkItemBranch) {
      return {
        content: [{
          type: "text",
          text: "Work item is missing required repository URL or branch information"
        }],
        isError: true
      };
    }
    
    const result = await checkoutWorkitemBranch({
      repoUrl: workItem.SourceCodeRepository.repoUrl,
      branchName: workItem.WorkItemBranch,
      localPath: safeLocalPath
    });
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
}
