import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Services, Toolset } from "@salesforce/mcp-provider-api";

const DESCRIPTION: string = `Lists all authenticated Salesforce orgs with type identification. Useful for selecting which org to use for further operations.`;

const inputSchema = z.object({
    random_string: z.string().optional().describe("Dummy parameter for no-parameter tools")
});
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
    orgs: z.array(z.object({
        username: z.string().describe("Username of the org"),
        instanceUrl: z.string().describe("Instance URL of the org"),
        orgId: z.string().describe("Org ID"),
        orgType: z.string().describe("Type of org (DevOps Center, Sandbox, etc.)")
    }))
});
type OutputArgsShape = typeof outputSchema.shape;

/**
 * MCP tool for listing authenticated Salesforce orgs with DevOps type identification.
 */
export class SfDevopsListOrgsMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
    public static readonly NAME: string = 'sf-devopslist-orgs';

    public constructor(private readonly services: Services) {
        super();
    }

    public getReleaseState(): ReleaseState {
        return ReleaseState.NON_GA;
    }

    public getToolsets(): Toolset[] {
        return [Toolset.ORGS];
    }

    public getName(): string {
        return SfDevopsListOrgsMcpTool.NAME;
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "List Salesforce DevOps Orgs",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: outputSchema.shape,
            annotations: {
                readOnlyHint: true
            }
        };
    }

    public async exec(input: any): Promise<CallToolResult> {
        try {
            const orgs = await this.services.getOrgService().getAllowedOrgs();
            const result = { orgs };
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                structuredContent: result
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: `Error listing orgs. Please check your authentication and try again.` }],
                isError: true
            };
        }
    }
}
