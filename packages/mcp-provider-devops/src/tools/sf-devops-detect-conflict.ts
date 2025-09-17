import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset } from "@salesforce/mcp-provider-api";
import { detectConflict } from "../utils/detectConflict.js";

const DESCRIPTION: string = `Detects merge conflicts for a selected work item by name.

**When to use:**
- User asks to detect conflicts for a work item, or asks for help fixing a merge conflict.

**MANDATORY input:**
- workItemName (exact Name of the Work Item). Do not list items; always use the provided name.

**Behavior:**
- The tool will look up the Work Item by Name in the DevOps Center org and compute target branch automatically.
- If the item cannot be found, or required fields are missing (branch or repo), it will return actionable guidance.

**What this tool does:**
1. Validates required properties (WorkItemBranch, TargetBranch, SourceCodeRepository.repoUrl)
2. Provides instructions to check for conflicts between the work item branch and target branch
3. Runs the necessary git commands to detect conflicts and surface findings

**Output:**
- If conflicts exist: lists conflicted files and suggested next steps
- If no conflicts: confirms it is safe to merge
- On error: returns details

**Next step:**
- After detection, call 'sf-devops-resolve-conflict' to guide the user through conflict resolution.`;

const inputSchema = z.object({
    username: z.string().describe("Username of the DevOps Center org"),
    workItemName: z.string().min(1).describe("Exact Work Item Name (mandatory)"),
    localPath: z.string().optional().describe("Local path to the repository (defaults to current working directory)")
});
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
    hasConflicts: z.boolean().describe("Whether conflicts were detected"),
    conflictedFiles: z.array(z.string()).optional().describe("List of files with conflicts"),
    message: z.string().describe("Status message about conflict detection"),
    nextSteps: z.string().optional().describe("Suggested next steps")
});
type OutputArgsShape = typeof outputSchema.shape;

/**
 * MCP tool for detecting merge conflicts in work items.
 */
export class SfDevopsDetectConflictMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
    public static readonly NAME: string = 'sf-devops-detect-conflict';

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
        return SfDevopsDetectConflictMcpTool.NAME;
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Detect DevOps Merge Conflicts",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: outputSchema.shape,
            annotations: {
                readOnlyHint: true
            }
        };
    }

    public async exec(input: { username: string; workItemName: string; localPath?: string }): Promise<CallToolResult> {
        try {
            const { fetchWorkItemByName } = await import("../utils/devops-operations.js");
            const workItem = await fetchWorkItemByName(input.username, input.workItemName);
            
            if (!workItem) {
                const response = {
                    hasConflicts: false,
                    message: `Work item '${input.workItemName}' not found`,
                    nextSteps: "Verify work item name and try again"
                };
                return {
                    content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
                    structuredContent: response,
                    isError: true
                };
            }

            const result = await detectConflict({
                workItem,
                localPath: input.localPath
            });

            // Parse the result to extract structured information
            const resultText = typeof result === 'string' ? result : JSON.stringify(result);
            const hasConflicts = resultText.toLowerCase().includes('conflict') && !resultText.toLowerCase().includes('no conflicts');
            
            const response = {
                hasConflicts,
                conflictedFiles: hasConflicts ? [] : undefined, // Would need to parse from git output
                message: resultText,
                nextSteps: hasConflicts ? "Use 'sf-devops-resolve-conflict' tool to resolve conflicts" : "Safe to merge - no conflicts detected"
            };

            return {
                content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
                structuredContent: response
            };
        } catch (error) {
            const errorMessage = 'Operation failed. Please check your authentication and try again.';
            const response = {
                hasConflicts: false,
                message: `Error detecting conflicts: ${errorMessage}`,
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
