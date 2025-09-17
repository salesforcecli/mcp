import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset } from "@salesforce/mcp-provider-api";
import { fetchProjectsMP } from "../utils/getProjectsMP.js";

const DESCRIPTION: string = `List DevOps Center Projects when the request comes from a Managed Package DevOps user.

**Scenario:**
- Use this tool in managed package workflows to list projects in the DevOps Center org.
- First select the DevOps Center org (use 'sf-devopslist-orgs' if needed), then pass its username here.

**Input Parameters:**
- username: Username of the DevOps Center org

**Output:**
- Returns an array of project records with fields: Id, Name, Description.`;

const inputSchema = z.object({
    username: z.string().describe("Username of the DevOps Center org")
});
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
    projects: z.array(z.object({
        Id: z.string().describe("Project ID"),
        Name: z.string().describe("Project Name"),
        Description: z.string().optional().describe("Project Description")
    })).describe("List of managed package projects")
});
type OutputArgsShape = typeof outputSchema.shape;

export class SfDevopsListProjectsMpMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
    public static readonly NAME: string = 'sf-devops-list-projects-mp';

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
        return SfDevopsListProjectsMpMcpTool.NAME;
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "List DevOps Projects (Managed Package)",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: outputSchema.shape,
            annotations: {
                readOnlyHint: true
            }
        };
    }

    public async exec(input: { username: string }): Promise<CallToolResult> {
        try {
            const projects = await fetchProjectsMP(input.username);
            const result = { projects };
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                structuredContent: result
            };
        } catch (error) {
            const errorMessage = 'Operation failed. Please check your authentication and try again.';
            return {
                content: [{ type: "text", text: `Error fetching managed package projects: ${errorMessage}` }],
                isError: true
            };
        }
    }
}
