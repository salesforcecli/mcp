import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    McpTool,
    McpToolConfig,
    ReleaseState,
    Toolset,
} from "@salesforce/mcp-provider-api";
import { ListOrgsAction, ListOrgsInput } from "../actions/list-orgs.js";

const DESCRIPTION = `Lists all Salesforce orgs the user is currently authenticated with (logged into) on this machine. Useful for selecting which org to use for further operations. The output is a list of orgs with non-sensitive details such as username, instance URL, org ID, and org type.`;

const inputSchema = z.object({
    random_string: z.string().optional().describe("Dummy parameter for no-parameter tools"),
});

type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape; // Let the LLM figure out the output structure

export class SfDevopsListOrgsTool extends McpTool<InputArgsShape, OutputArgsShape> {
    private readonly action: ListOrgsAction;

    constructor(action: ListOrgsAction) {
        super();
        this.action = action;
    }

    public getReleaseState(): ReleaseState {
        return ReleaseState.NON_GA;
    }

    public getToolsets(): Toolset[] {
        return [Toolset.ORGS];
    }

    public getName(): string {
        return "sf-devops-list-orgs";
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "List Authenticated Salesforce Orgs",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: undefined,
            annotations: {
                readOnlyHint: true,
            },
        };
    }

    public async exec(_input: InputArgs): Promise<CallToolResult> {
        const listOrgsInput: ListOrgsInput = {};

        const result = await this.action.exec(listOrgsInput);

        if (result.status !== "success") {
            return {
                content: [{
                    type: "text",
                    text: `Failed to list orgs: ${result.status}`,
                }],
                isError: true,
            };
        }

        return {
            content: [{
                type: "text",
                text: JSON.stringify(result.orgs, null, 2),
            }],
        };
    }
}
