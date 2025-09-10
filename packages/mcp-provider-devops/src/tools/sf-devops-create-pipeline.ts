import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    McpTool,
    McpToolConfig,
    ReleaseState,
    Toolset,
} from "@salesforce/mcp-provider-api";
import { CreatePipelineAction, CreatePipelineInput } from "../actions/create-pipeline.js";

const DESCRIPTION = `Creates a DevOps Center Pipeline in the DevOps Center org.

**Usage Notes:**
- Use for the DevOps Center org only. If org is not provided, use 'sf-devops-list-orgs' to select the DevOps Center org.
- pipeline_name and repo_url are mandatory.
- stages are optional; defaults will be used if not provided (Integration/UAT/Staging).`;

const inputSchema = z.object({
    username: z.string().describe("Username of the DevOps Center org"),
    pipeline_name: z.string().describe("Name of the pipeline to create"),
    repo_url: z.string().describe("Git repository URL (e.g., GitHub URL)"),
    stages: z.array(
        z.object({
            name: z.string(),
            branch: z.string(),
            environment: z.string()
        })
    ).optional().describe("Optional pipeline stages; defaults used if omitted")
});

type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsCreatePipelineTool extends McpTool<InputArgsShape, OutputArgsShape> {
    private readonly action: CreatePipelineAction;

    constructor(action: CreatePipelineAction) {
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
        return "sf-devops-create-pipeline";
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Create DevOps Center Pipeline",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: undefined,
            annotations: {
                readOnlyHint: false,
            },
        };
    }

    public async exec(input: InputArgs): Promise<CallToolResult> {
        const createInput: CreatePipelineInput = {
            username: input.username,
            pipeline_name: input.pipeline_name,
            repo_url: input.repo_url,
            stages: input.stages
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
