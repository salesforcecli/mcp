import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    McpTool,
    McpToolConfig,
    ReleaseState,
    Toolset,
} from "@salesforce/mcp-provider-api";
import { PatchEnvironmentAction, PatchEnvironmentInput } from "../actions/patch-environment.js";

const DESCRIPTION = `PATCH a DevOps Environment by Id in the DevOps Center org.

**Usage Notes:**
- Use for the DevOps Center org only.
- The EnvironmentID must be selected from pipeline details. If not selected, first use 'sf-devops-list-pipelines' and 'sf-devops-get-pipeline-details' for the same org, then choose which stage's environment to patch and pass that EnvironmentID here.

**API:** PATCH /services/data/v65.0/connect/devops/environment/<EnvironmentID>
**Body:** null`;

const inputSchema = z.object({
    username: z.string().describe("Username of the DevOps Center org"),
    environmentId: z.string().describe("Environment ID selected from pipeline details")
});

type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsPatchEnvironmentTool extends McpTool<InputArgsShape, OutputArgsShape> {
    private readonly action: PatchEnvironmentAction;

    constructor(action: PatchEnvironmentAction) {
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
        return "sf-devops-patch-environment";
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Patch DevOps Environment",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: undefined,
            annotations: {
                readOnlyHint: false,
            },
        };
    }

    public async exec(input: InputArgs): Promise<CallToolResult> {
        const patchInput: PatchEnvironmentInput = {
            username: input.username,
            environmentId: input.environmentId
        };

        const result = await this.action.exec(patchInput);

        return {
            content: [{
                type: "text",
                text: result.message,
            }],
            isError: !result.success,
        };
    }
}
