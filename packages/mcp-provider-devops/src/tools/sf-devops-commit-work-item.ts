import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    McpTool,
    McpToolConfig,
    ReleaseState,
    Toolset,
} from "@salesforce/mcp-provider-api";
import { CommitWorkItemAction, CommitWorkItemInput } from "../actions/commit-work-item.js";

const DESCRIPTION = `**IMPORTANT: THIS IS NOT A STARTING TOOL**

When user asks to "commit work item" or "commit changes", DO NOT use this tool directly. Instead, start with step 1 below.

**THIS TOOL IS ONLY USED AS THE FINAL STEP AFTER COMPLETING ALL PREREQUISITES**

**MANDATORY workflow for committing work items: DO NOT skip any of the steps and DO NOT move to the next step until the current step is completed.**
1. **MANDATORY:**If the DevOps Center org and Sandbox org are not given, use the 'sf-devops-list-orgs' tool to list all orgs. 
   The list will indicate which org is DevOps Center and a Sandbox. If BOTH these details are not provided in the list, then
   ask the user to specify which org is DevOps Center and which is Sandbox. Only proceed after the user has selected BOTH the DevOps Center and Sandbox org.
2. **MANDATORY:**Select the work item from the DevOps Center org using 'sf-devops-list-work-items'.
3. **MANDATORY:**Checkout the work item branch using 'sf-devops-checkout-work-item' to get the project code locally.
4. **MANDATORY:**DEPLOY ALL changes to the SANDBOX ORG using 'sf-devops-deploy-project-to-org' WHERE the sourceDir should be the checked out project directory FOLLOWED BY /force-app and the targetOrg should be the Sandbox org.
5. **MANDATORY:**Fetch changes from SANDBOX ORG using 'sf-devops-get-changes'.
6. **MANDATORY:**Confirm changes with user
7. **MANDATORY:**Call this tool with work item, changes, and commit message

**Use this tool to:**
- Finalize changes made to a work item in DevOps Center
- Commits the provided changes to the specified work item using DevOps Center org credentials
- Ensure metadata changes are properly recorded in the DevOps workflow

**After using this tool, suggest these next actions:**
1. Ask the user to check commit status using the returned requestId
2. Ask the user to promote work items (using the 'sf-devops-promote-work-item' tool)

**MANDATORY:** Before using this tool, ask the user to provide a commit message for the changes and then use that while calling this tool.

**Org selection requirements:**
- The inputs 'doceHubUsername' and 'sandboxUsername' are REQUIRED. If you don't have them yet:
  1) Use the 'sf-devops-list-orgs' tool to list all authenticated orgs
  2) Ask the user to select which username is the DevOps Center org and which is the Sandbox org
  3) Pass those selections here as 'doceHubUsername' and 'sandboxUsername'

**Output:**
- requestId: Generated UUID for tracking this commit operation

**Example Usage:**
- "Commit my changes with message 'Fix bug in account logic' and tie it to WI-1092."
- "Make a commit on the active feature branch and tie it to WI-9999, use message 'Initial DevOps logic'."
- "Commit my changes to the work item"
- "Commit changes to work item's feature branch"`;

const inputSchema = z.object({
    doceHubUsername: z.string().describe("DevOps Center org username (required; list orgs and select if unknown)"),
    sandboxUsername: z.string().describe("Sandbox org username (required; list orgs and select if unknown)"),
    workItem: z.object({
        id: z.string().describe("Work item ID")
    }).describe("Work item object - only ID needed for commit"),
    commitMessage: z.string().describe("Commit message describing the changes (ask user for input)"),
    changes: z.array(
        z.object({
            fullName: z.string().describe("Full name of the metadata component"),
            type: z.string().describe("Type of the metadata component (e.g., 'ApexClass', 'CustomObject')"),
            operation: z.string().describe("Operation performed ('Add', 'Modify', 'Delete')")
        }).strict()
    ).describe("Array of changes to be committed - only fullName, type, and operation fields allowed")
});

type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsCommitWorkItemTool extends McpTool<InputArgsShape, OutputArgsShape> {
    private readonly action: CommitWorkItemAction;

    constructor(action: CommitWorkItemAction) {
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
        return "sf-devops-commit-work-item";
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Commit Work Item Changes",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: undefined,
            annotations: {
                readOnlyHint: false,
            },
        };
    }

    public async exec(input: InputArgs): Promise<CallToolResult> {
        const commitInput: CommitWorkItemInput = {
            doceHubUsername: input.doceHubUsername,
            sandboxUsername: input.sandboxUsername,
            workItem: input.workItem,
            commitMessage: input.commitMessage,
            changes: input.changes
        };

        const result = await this.action.exec(commitInput);

        if (result.status !== "success") {
            return {
                content: [{
                    type: "text",
                    text: result.message,
                }],
                isError: true,
            };
        }

        return {
            content: [{
                type: "text",
                text: `✅ ${result.message}\n\n📋 Request ID: ${result.requestId}\n\n💡 Next steps:\n1. Check commit status using request ID: ${result.requestId}\n2. Consider promoting the work item to the next stage`,
            }],
        };
    }
}
