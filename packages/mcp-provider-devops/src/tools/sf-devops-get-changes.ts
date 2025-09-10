import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    McpTool,
    McpToolConfig,
    ReleaseState,
    Toolset,
} from "@salesforce/mcp-provider-api";
import { GetChangesAction, GetChangesInput } from "../actions/get-changes.js";

const DESCRIPTION = `**MANDATORY:** Before using this tool, always ask the user to confirm that the selected org is a DevOps Center, or Sandbox org. 
      If no org is selected, use the 'list-orgs' tool to list all orgs. The list will indicate which org is DevOps Center, or Sandbox if possible. 
      If these details are not provided in the list, ask the user to specify which org is DevOps Center org and which is Sandbox org. Prompt the user to select a Sandbox org.
      **Important:** This tool should ONLY be called for Sandbox orgs and must NEVER be called for the DevOps Center org. If a DevOps Center org is selected, abort the operation and inform the user to select a Sandbox org instead.

This tool retrieves a list of changed files (metadata, code, or configuration) from a Salesforce organization (org), specifically from a Sandbox or Dev org.

Use this tool to see what files have been modified in your development or testing environments before committing or promoting changes.

You can also use this tool to get changes related to a specific work item.

When using this tool, the LLM must:
- Clearly state which org (by username and instance URL) it is making the call to, and explicitly mention whether it is a Sandbox org. Never use this tool for a DevOps Center org.
- If the org type is unclear or the org is a DevOps Center org, inform the user and request a valid Sandbox org selection.

**How to use this tool:**

1. **Identify the Sandbox or Dev Org:**
   If you do not know which org is your Sandbox or Dev org, first use the 'list-orgs' tool to display all orgs you are logged into.
   Ask the user to specify which org is the Sandbox or Dev org from the list.

2. **Pass the Username:**
   Once the correct org is identified, use its 'username' as the 'username' parameter for this tool.
   **Never use this tool for the DevOps Center org.**

3. **Fetch Changes:**
   Provide the 'username' and any optional parameters (offset, limit) to retrieve the list of changed files.

4. **Every time query for fresh changes do not used cached changes.**

**Output:**
A JSON array containing details of changed files, including metadata, code, or configuration changes that have not yet been committed. This helps you review and manage changes in your development workflow.`;

const inputSchema = z.object({
    username: z.string().describe("Username of the Sandbox or Dev org to fetch changes from"),
    limit: z.number().optional().default(30).describe("Number of records to return (default 30)"),
    offset: z.number().optional().default(0).describe("Starting offset for pagination (default 0)")
});

type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsGetChangesTool extends McpTool<InputArgsShape, OutputArgsShape> {
    private readonly action: GetChangesAction;

    constructor(action: GetChangesAction) {
        super();
        this.action = action;
    }

    public getReleaseState(): ReleaseState {
        return ReleaseState.NON_GA;
    }

    public getToolsets(): Toolset[] {
        return [Toolset.METADATA];
    }

    public getName(): string {
        return "sf-devops-get-changes";
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Get Changes from Salesforce Org",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: undefined,
            annotations: {
                readOnlyHint: true,
            },
        };
    }

    public async exec(input: InputArgs): Promise<CallToolResult> {
        const getChangesInput: GetChangesInput = {
            username: input.username,
            limit: input.limit,
            offset: input.offset
        };

        const result = await this.action.exec(getChangesInput);

        if (result.status !== "success") {
            return {
                content: [{
                    type: "text",
                    text: `Failed to get changes: ${result.status}`,
                }],
                isError: true,
            };
        }

        return {
            content: [{
                type: "text",
                text: JSON.stringify(result.changes, null, 2),
            }],
        };
    }
}
