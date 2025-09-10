import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    McpTool,
    McpToolConfig,
    ReleaseState,
    Toolset,
} from "@salesforce/mcp-provider-api";
import { GetPipelineWithStagesAction, GetPipelineWithStagesInput } from "../actions/get-pipeline-with-stages.js";

const DESCRIPTION = `Returns the DevOps pipeline for a selected project along with its stages.

**When to use:**
- After selecting a project, to discover its pipeline and available stages
- Before promotion, to let the user select a target stage

**Input Parameters:**
- username: DevOps Center org username. If missing, use 'sf-devops-list-orgs' to list and select.
- project: Selected project object. If missing, use 'sf-devops-list-projects' to list and select.
  - id: Project Id
  - name: Project name

**What this tool does:**
1) Finds the pipeline Id mapped to the project via DevopsProjectPipeline
2) Fetches all stages for that pipeline (Id, Name, NextStageId, Branch name)
3) Optionally enriches pipeline name

**Output:**
- JSON object with 'pipeline' and 'stages' array. Each stage includes Id, Name, NextStageId, and SourceCodeRepositoryBranch.Name (if available).`;

const inputSchema = z.object({
    username: z.string().describe("Username of the DevOps Center org"),
    project: z.object({
        id: z.string().describe("Project ID"),
        name: z.string().describe("Project name")
    }).describe("Selected project details")
});

type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsGetPipelineWithStagesTool extends McpTool<InputArgsShape, OutputArgsShape> {
    private readonly action: GetPipelineWithStagesAction;

    constructor(action: GetPipelineWithStagesAction) {
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
        return "sf-devops-get-pipeline-with-stages";
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Get DevOps Pipeline with Stages",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: undefined,
            annotations: {
                readOnlyHint: true,
            },
        };
    }

    public async exec(input: InputArgs): Promise<CallToolResult> {
        const pipelineInput: GetPipelineWithStagesInput = {
            username: input.username,
            project: input.project
        };

        const result = await this.action.exec(pipelineInput);

        if (result.status !== "success") {
            return {
                content: [{
                    type: "text",
                    text: `Failed to get pipeline with stages: ${result.status}`,
                }],
                isError: true,
            };
        }

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    pipeline: result.pipeline,
                    stages: result.stages
                }, null, 2),
            }],
        };
    }
}
