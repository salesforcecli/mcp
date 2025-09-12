import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    McpTool,
    McpToolConfig,
    ReleaseState,
    Toolset,
} from "@salesforce/mcp-provider-api";
import { CreateWorkItemAction, CreateWorkItemInput } from "../actions/create-work-item.js";

const DESCRIPTION = `Creates a new DevOps Center Work Item in the specified project.

**Usage Notes:**
- This tool must be used for the DevOps Center org only. If the org is not provided, use 'sf-devops-list-orgs' to select the DevOps Center org.
- A DevOps Center project must be selected first from the same DevOps Center org. If the projectId is not known, call 'sf-devops-list-projects' for that org and ask the user to select a project. Use that project's Id here.
- Ensure the org used to select the project is the same org passed to this tool.

**API:** POST /services/data/v65.0/connect/devops/projects/<ProjectID>/workitem
**Body:** { "subject": string, "description": string }`;

const inputSchema = z.object({
    username: z.string().describe("Username of the DevOps Center org"),
    projectId: z.string().describe("DevOps Center Project ID selected from sf-devops-list-projects for the same org"),
    subject: z.string().describe("Work item subject"),
    description: z.string().describe("Work item description")
});

type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsCreateWorkItemTool extends McpTool<InputArgsShape, OutputArgsShape> {
    private readonly action: CreateWorkItemAction;

    constructor(action: CreateWorkItemAction) {
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
        return "sf-devops-create-work-item";
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Create DevOps Work Item",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: undefined,
            annotations: {
                readOnlyHint: false,
            },
        };
    }

    public async exec(input: InputArgs): Promise<CallToolResult> {
        const createInput: CreateWorkItemInput = {
            username: input.username,
            projectId: input.projectId,
            subject: input.subject,
            description: input.description
        };

        const result = await this.action.exec(createInput);

        return {
            content: [{
                type: "text",
                text: result.message,
            }],
            isError: !result.success,
        };
    }
}
