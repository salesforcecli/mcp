import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    McpTool,
    McpToolConfig,
    ReleaseState,
    Toolset,
} from "@salesforce/mcp-provider-api";
import { ListProjectsAction, ListProjectsInput } from "../actions/list-projects.js";

const DESCRIPTION = `**MANDATORY:** If the DevOps Center org is not given, use the 'sf-devops-list-orgs' tool to list all orgs. 
      The list will indicate which org is DevOps Center, or Sandbox if possible. If these details are not provided in the list, 
      ask the user to specify which org is DevOps Center org. Only proceed after the user has selected the DevOps Center org.

**MANDATORY:** Before using this tool, always confirm the selected org is the DevOps Center org. If not, prompt the user to select a DevOps Center org. This tool must NOT be used for any non DevOps Center or Sandbox orgs.

Lists DevOps Center Projects available in the specified org using SOQL on DevopsProject.

**Output:**
An array of project records with fields such as Id, Name, Description.`;

const inputSchema = z.object({
    username: z.string().describe("Username of the DevOps Center org"),
});

type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsListProjectsTool extends McpTool<InputArgsShape, OutputArgsShape> {
    private readonly action: ListProjectsAction;

    constructor(action: ListProjectsAction) {
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
        return "sf-devops-list-projects";
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "List DevOps Center Projects",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: undefined,
            annotations: {
                readOnlyHint: true,
            },
        };
    }

    public async exec(input: InputArgs): Promise<CallToolResult> {
        const listProjectsInput: ListProjectsInput = {
            username: input.username
        };

        const result = await this.action.exec(listProjectsInput);

        if (result.status !== "success") {
            return {
                content: [{
                    type: "text",
                    text: `Failed to list projects: ${result.status}`,
                }],
                isError: true,
            };
        }

        return {
            content: [{
                type: "text",
                text: JSON.stringify(result.projects, null, 2),
            }],
        };
    }
}
