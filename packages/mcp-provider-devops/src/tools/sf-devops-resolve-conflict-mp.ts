import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset } from "@salesforce/mcp-provider-api";
import { resolveConflict } from "../utils/resolveConflict.js";

const DESCRIPTION: string = `Resolves merge conflicts for a selected work item in managed package workflows.

**When to use:**
- After running 'sf-devops-detect-conflict-mp' and conflicts were found.

**MANDATORY input:**
- workItemName (exact Name of the Work Item) and username of the DevOps Center org.

**Behavior:**
- Looks up the Work Item by Name in managed package context, validates required fields, and prepares per-file resolution commands.
- If branch/target branch/repo URL are missing, returns actionable guidance to fix inputs first.

**What this tool does:**
1. Confirms the repo is in a conflicted state
2. Lists conflicted files
3. For each file, provides choices (keep current / keep incoming / keep both ) with exact git commands
4. Guides removing conflict markers, staging, and committing

**Output:**
- If conflicts exist: per-file action plan with commands
- If no conflicts: confirms the repo is clean
- On error: actionable troubleshooting

**Next step:**
- Re-run 'sf-devops-detect-conflict-mp' to verify, then promote or open a PR.`;

const inputSchema = z.object({
    username: z.string().describe("Username of the DevOps Center org"),
    workItemName: z.string().min(1).describe("Exact Work Item Name (mandatory)"),
    localPath: z.string().optional().describe("Local path to the repository (defaults to current working directory)")
});
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
    resolved: z.boolean().describe("Whether conflicts were resolved"),
    conflictedFiles: z.array(z.string()).optional().describe("List of files that had conflicts"),
    resolutionSteps: z.array(z.string()).optional().describe("Steps taken to resolve conflicts"),
    message: z.string().describe("Status message about conflict resolution"),
    nextSteps: z.string().optional().describe("Suggested next steps")
});
type OutputArgsShape = typeof outputSchema.shape;

export class SfDevopsResolveConflictMpMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
    public static readonly NAME: string = 'sf-devops-resolve-conflict-mp';

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
        return SfDevopsResolveConflictMpMcpTool.NAME;
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Resolve DevOps Merge Conflicts (Managed Package)",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: outputSchema.shape,
            annotations: {
                readOnlyHint: false
            }
        };
    }

    public async exec(input: { username: string; workItemName: string; localPath?: string }): Promise<CallToolResult> {
        try {
            // First fetch the work item by name using managed package functions
            const { fetchWorkItemByNameMP } = await import("../utils/getWorkItemsMP.js");
            const workItem = await fetchWorkItemByNameMP(input.username, input.workItemName);
            
            if (!workItem) {
                const response = {
                    resolved: false,
                    message: `Work item '${input.workItemName}' not found in managed package context`,
                    nextSteps: "Verify work item name and managed package configuration"
                };
                return {
                    content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
                    structuredContent: response,
                    isError: true
                };
            }

            const result = await resolveConflict({
                workItem,
                localPath: input.localPath
            });

            // Parse the result to extract structured information
            const resultText = typeof result === 'string' ? result : JSON.stringify(result);
            const resolved = resultText.toLowerCase().includes('resolved') || resultText.toLowerCase().includes('success');
            
            const response = {
                resolved,
                conflictedFiles: [], // Would need to parse from git output
                resolutionSteps: [], // Would need to parse from resolution process
                message: resultText,
                nextSteps: resolved ? "Run 'sf-devops-detect-conflict-mp' to verify, then promote or create PR" : "Review conflict resolution guidance and try again"
            };

            return {
                content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
                structuredContent: response
            };
        } catch (error) {
            const errorMessage = 'Operation failed. Please check your authentication and try again.';
            const response = {
                resolved: false,
                message: `Error resolving conflicts in managed package: ${errorMessage}`,
                nextSteps: "Check work item details and repository access"
            };
            
            return {
                content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
                structuredContent: response,
                isError: true
            };
        }
    }
}
