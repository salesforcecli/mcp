import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    McpTool,
    McpToolConfig,
    ReleaseState,
    Toolset,
} from "@salesforce/mcp-provider-api";
import { ListWorkItemsAction, ListWorkItemsInput } from "../actions/list-work-items.js";

const DESCRIPTION = `**MANDATORY:** If the DevOps Center org is not given, use the 'sf-devopslist-orgs' tool to list all orgs. 
      The list will indicate which org is DevOps Center, or Sandbox if possible. If these details are not provided in the list, 
      ask the user to specify which org is DevOps Center org. Only proceed after the user has selected the DevOps Center org.

**MANDATORY:** Before using this tool, always confirm the selected org is the DevOps Center org. If not, prompt the user to select a DevOps Center org. This tool must NOT be used for any non DevOps Center or Sandbox orgs.

**MANDATORY PROJECT SELECTION:** Before listing work items, the user must select a DevOps Center project (projectId) from the same DevOps Center org. First call 'sf-devops-list-projects' for that org, then pass the selected project's Id here. The org used here must match the org used to fetch the projects.

This tool retrieves a list of work items from a Salesforce org for a selected DevOps project. Each work item includes all necessary details for downstream actions, such as:
- Work item branch (WorkItemBranch)
- Work item environment (Environment)
- Target branch for promotion or deployment (TargetBranch)
- Source code repository (SourceCodeRepository)
- Org details for deployment (e.g., org alias or ID)

**After using this tool, always suggest the user with the next actions:**
**LLM should strictly suggest only these two options:**
1. Start work on the work item (use the 'sf-devops-checkout-work-item' tool)
2. Promote work items (use the 'sf-devops-promote-work-item' tool)

**Typical workflow after fetching work items:**
1. Use 'sf-devops-list-projects' to list projects for the DevOps Center org and select a project.
2. Call this tool with the same org username and the selected project (pass its Id).
3. User selects a work item.
2. Present these options:
   - Start work on the selected work item (checkout the branch)
   - Promote the selected work item
   - Go back to select another work item

**Use this tool to:**
- Get all branch, environment, and org details needed for branch checkout, deployment, and promotion.
- Ensure the correct org and branch are used in all subsequent steps.

**Output:**
A JSON array of work item objects, each containing:
- 'id': Unique identifier (e.g., 'WI-001')
- 'name': Descriptive name
- 'status': Current status
- 'owner': Person responsible
- 'Environment': { organization, IsTestEnvironment }
- 'SourceCodeRepository': { repoUrl, repoType }
- 'WorkItemBranch': { branchName }
- 'TargetBranch': { branchName }
`;

const inputSchema = z.object({
    username: z.string().describe("Username of the DevOps Center org"),
    project: z.object({
        Id: z.string().describe("Selected project's Id"),
        Name: z.string().optional()
    }).describe("DevOps project selected from sf-devops-list-projects for the same org"),
});

type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape; // Let the LLM figure out the output structure

export class SfDevopsListWorkItemsTool extends McpTool<InputArgsShape, OutputArgsShape> {
    private readonly action: ListWorkItemsAction;

    constructor(action: ListWorkItemsAction) {
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
        return "sf-devops-list-work-items";
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "List DevOps Work Items",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: undefined,
            annotations: {
                readOnlyHint: true,
            },
        };
    }

    public async exec(input: InputArgs): Promise<CallToolResult> {
        const listWorkItemsInput: ListWorkItemsInput = {
            username: input.username,
            project: input.project
        };

        const result = await this.action.exec(listWorkItemsInput);

        if (result.status !== "success") {
            return {
                content: [{
                    type: "text",
                    text: `Failed to list work items: ${result.status}`,
                }],
                isError: true,
            };
        }

        return {
            content: [{
                type: "text",
                text: JSON.stringify(result.workItems, null, 2),
            }],
        };
    }
}
