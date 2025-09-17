import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset } from "@salesforce/mcp-provider-api";
import { getWorkItemWithTargetBranch } from "../utils/getTargetBranch.js";

const DESCRIPTION: string = `Gets the target branch for a given work item in a selected pipeline, and returns the updated work item with TargetBranch populated.

**Usage:**
1. Provide the selected work item (standard WorkItem shape).

**Input Parameters:**
- username: Username of the DevOps Center org
- workItem: Selected work item with all required fields
- pipelineId: Optional selected pipeline Id (if omitted, will be derived from work item)

**Output:**
- Updated work item with TargetBranch populated`;

const inputSchema = z.object({
    username: z.string().describe("Username of the DevOps Center org"),
    workItem: z.object({
        id: z.string().describe("Work item ID"),
        name: z.string().describe("Work item name"),
        status: z.string().describe("Work item status"),
        owner: z.string().describe("Work item owner"),
        Environment: z.object({
            Org_Id: z.string(),
            Username: z.string(),
            IsTestEnvironment: z.boolean()
        }).optional(),
        SourceCodeRepository: z.object({
            repoUrl: z.string(),
            repoType: z.string()
        }).optional(),
        WorkItemBranch: z.string().optional(),
        TargetBranch: z.string().optional(),
        PipelineStageId: z.string().optional(),
        DevopsProjectId: z.string().describe("DevOps project ID")
    }).describe("Selected work item"),
    pipelineId: z.string().optional().describe("Selected pipeline Id (if omitted, list pipelines and select one first)")
});
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
    workItem: z.object({
        id: z.string().describe("Work item ID"),
        name: z.string().describe("Work item name"),
        TargetBranch: z.string().describe("Computed target branch")
    }).describe("Work item with target branch")
});
type OutputArgsShape = typeof outputSchema.shape;

export class SfDevopsGetTargetBranchMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
    public static readonly NAME: string = 'sf-devops-get-target-branch';

    public constructor(private readonly services: Services) {
        super();
    }

    public getReleaseState(): ReleaseState {
        return ReleaseState.NON_GA;
    }

    public getToolsets(): Toolset[] {
        return [Toolset.OTHER];
    }

    public getName(): string {
        return SfDevopsGetTargetBranchMcpTool.NAME;
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Get DevOps Target Branch",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: outputSchema.shape,
            annotations: {
                readOnlyHint: true
            }
        };
    }

    public async exec(input: { 
        username: string; 
        workItem: any;
        pipelineId?: string;
    }): Promise<CallToolResult> {
        try {
            if (!input.workItem || !input.username) {
                return {
                    content: [{
                        type: "text",
                        text: "username and workItem are required. Use 'sf-devopslist-orgs' and 'list_workitems' first, then call this tool."
                    }],
                    isError: true
                };
            }

            const result = await getWorkItemWithTargetBranch({ 
                username: input.username, 
                workItem: input.workItem 
            });
            
            const response = { workItem: result };
            return {
                content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
                structuredContent: response
            };
        } catch (error) {
            const errorMessage = 'Operation failed. Please check your authentication and try again.';
            return {
                content: [{ type: "text", text: `Error getting target branch: ${errorMessage}` }],
                isError: true
            };
        }
    }
}
