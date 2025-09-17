import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset } from "@salesforce/mcp-provider-api";
import { createPipeline } from "../utils/createPipeline.js";

const DESCRIPTION: string = `Creates a DevOps Center Pipeline in the DevOps Center org.

**Usage Notes:**
- Use for the DevOps Center org only. If org is not provided, use 'sf-devopslist-orgs' to select the DevOps Center org.
- pipeline_name and repo_url are mandatory.
- stages are optional; defaults will be used if not provided (Integration/UAT/Staging).

**Input Parameters:**
- username: Username of the DevOps Center org
- pipeline_name: Name of the pipeline to create
- repo_url: Git repository URL (e.g., GitHub URL)
- stages: Optional pipeline stages; defaults used if omitted

**Output:**
- Details of the created pipeline including its ID and configuration`;

const inputSchema = z.object({
    username: z.string().describe("Username of the DevOps Center org"),
    pipeline_name: z.string().describe("Name of the pipeline to create"),
    repo_url: z.string().describe("Git repository URL (e.g., GitHub URL)"),
    stages: z.array(
        z.object({
            name: z.string().describe("Stage name"),
            branch: z.string().describe("Branch name"),
            environment: z.string().describe("Environment name")
        })
    ).optional().describe("Optional pipeline stages; defaults used if omitted")
});
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
    pipeline: z.object({
        id: z.string().describe("Pipeline ID"),
        name: z.string().describe("Pipeline name"),
        status: z.string().describe("Creation status")
    }).describe("Created pipeline details")
});
type OutputArgsShape = typeof outputSchema.shape;

export class SfDevopsCreatePipelineMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
    public static readonly NAME: string = 'sf-devops-create-pipeline';

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
        return SfDevopsCreatePipelineMcpTool.NAME;
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Create DevOps Pipeline",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: outputSchema.shape,
            annotations: {
                readOnlyHint: false
            }
        };
    }

    public async exec(input: { 
        username: string; 
        pipeline_name: string; 
        repo_url: string;
        stages?: Array<{ name: string; branch: string; environment: string }>;
    }): Promise<CallToolResult> {
        try {
            const result = await createPipeline({
                username: input.username,
                pipeline_name: input.pipeline_name,
                repo_url: input.repo_url,
                stages: input.stages
            });
            
            const response = { pipeline: result };
            return {
                content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
                structuredContent: response
            };
        } catch (error) {
            const errorMessage = 'Operation failed. Please check your authentication and try again.';
            return {
                content: [{ type: "text", text: `Error creating pipeline: ${errorMessage}` }],
                isError: true
            };
        }
    }
}
