import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    McpTool,
    McpToolConfig,
    ReleaseState,
    Toolset,
} from "@salesforce/mcp-provider-api";
import { CheckCommitStatusAction, CheckCommitStatusInput } from "../actions/check-commit-status.js";

const DESCRIPTION = `Checks the status of a specific commit by querying the "DevopsRequestInfo" Salesforce object using the RequestToken field.

**Use this tool to:**
- Check the status of a specific commit using its Request Token
- Verify commit processing completion before creating a pull request
- Ensure commits are ready for PR creation

**Input Parameters:**
- username: The username of the DevOps Center org to authenticate with
- requestId: The specific request token to check status for (REQUIRED)

**Output:**
- Status field value for the specified request token
- Request token and associated status information`;

const inputSchema = z.object({
    username: z.string().describe("Username of the DevOps Center org to authenticate with"),
    requestId: z.string().describe("The specific request ID to check status for")
});

type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsCheckCommitStatusTool extends McpTool<InputArgsShape, OutputArgsShape> {
    private readonly action: CheckCommitStatusAction;

    constructor(action: CheckCommitStatusAction) {
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
        return "sf-devops-check-commit-status";
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Check DevOps Commit Status",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: undefined,
            annotations: {
                readOnlyHint: true,
            },
        };
    }

    public async exec(input: InputArgs): Promise<CallToolResult> {
        const checkStatusInput: CheckCommitStatusInput = {
            username: input.username,
            requestId: input.requestId
        };

        const result = await this.action.exec(checkStatusInput);

        return {
            content: [{
                type: "text",
                text: `Request ID: ${result.requestToken}\nStatus: ${result.status}${result.result && typeof result.result === 'object' ? '\n\nDetails:\n' + JSON.stringify(result.result, null, 2) : ''}`,
            }],
        };
    }
}
