import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    McpTool,
    McpToolConfig,
    ReleaseState,
    Toolset,
} from "@salesforce/mcp-provider-api";
import { CheckoutWorkItemAction, CheckoutWorkItemInput } from "../actions/checkout-work-item.js";

const DESCRIPTION = `Checks out the branch associated with a selected work item.

**MANDATORY:** Always ask the user to provide the local path (repoPath) to the checked-out repository. 
You may show the current working directory as an option, but do not proceed until the user has explicitly chosen a repo path. 
Never assume or default to a path without user confirmation.

This tool takes the repository URL, branch name, and an optional local path as input. If localPath is not provided, the current working directory will be used. It clones the repository to the specified local path if it does not exist there, and checks out the specified branch. Assumes the user is already authenticated with the git CLI.

**How to use this tool:**

1. **Work Item Selection Required:**
   - Before using this tool, ensure that the user has selected a work item. The work item should contain both the repository URL and the branch name (typically found in the WorkItemBranch and SourceCodeRepository properties).
   - If no work item is currently selected, prompt the user to select a work item from the list of fetched work items.
   - If no work items have been fetched yet, suggest using the 'get-work-items' tool to retrieve the list of available work items for the user to select from.

2. **Input Parameters:**
   - "repoUrl": The URL of the git repository associated with the work item.
   - "branchName": The name of the branch to check out, as specified in the work item.
   - "localPath" (mandatory): The directory path where the repository should be cloned/checked out. Must be provided by the user. The current working directory can be shown as an option, but do not proceed until the user chooses.

3. **Operation:**
   - If the repository does not exist at the specified local path, the tool will clone it there.
   - The tool will then check out the specified branch in that directory.
   - The output will explicitly show the path where the repository is cloned.

**Typical workflow:**
- Fetch work items using the 'get-work-items' tool.
- Ask the user to select a work item to work on.
- Use this tool to check out the branch associated with the selected work item at the specified location.

**Output:**
- Success or error message indicating the result of the clone and checkout operations, including the path where the repository is cloned.`;

const inputSchema = z.object({
    repoUrl: z.string().describe("The URL of the git repository."),
    branchName: z.string().describe("The name of the branch to check out."),
    localPath: z.string().optional().describe("The directory path where the repository should be cloned/checked out. If not provided, ask user to provide the path where project is cloned.")
});

type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsCheckoutWorkItemTool extends McpTool<InputArgsShape, OutputArgsShape> {
    private readonly action: CheckoutWorkItemAction;

    constructor(action: CheckoutWorkItemAction) {
        super();
        this.action = action;
    }

    public getReleaseState(): ReleaseState {
        return ReleaseState.NON_GA;
    }

    public getToolsets(): Toolset[] {
        return [Toolset.OTHER];
    }

    public getName(): string {
        return "sf-devops-checkout-work-item";
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Checkout DevOps Work Item Branch",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: undefined,
            annotations: {
                readOnlyHint: false,
            },
        };
    }

    public async exec(input: InputArgs): Promise<CallToolResult> {
        const checkoutInput: CheckoutWorkItemInput = {
            repoUrl: input.repoUrl,
            branchName: input.branchName,
            localPath: input.localPath
        };

        const result = await this.action.exec(checkoutInput);

        return {
            content: [{
                type: "text",
                text: result.message,
            }],
            isError: !result.success,
        };
    }
}
