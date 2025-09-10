import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    McpTool,
    McpToolConfig,
    ReleaseState,
    Toolset,
} from "@salesforce/mcp-provider-api";
import { DetectConflictAction, DetectConflictInput } from "../actions/detect-conflict.js";

const DESCRIPTION = `Detects merge conflicts for a selected work item.

**When to use:**
- User asks to detect conflicts for a work item, or asks for help fixing a merge conflict.

**MANDATORY prerequisites:**
- A workItem is provided. If not, first list work items with 'sf-devops-list-work-items' so the user can select one, then call this tool.
- workItem.TargetBranch is a non-empty string. If missing, first call 'sf-devops-get-target-branch' to annotate the work item with the correct target branch, then call this tool again.

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
    workItem: z.object({
        id: z.string().describe("Work item ID"),
        name: z.string().describe("Work item name"),
        status: z.string().describe("Work item status"),
        owner: z.string().describe("Work item owner"),
        WorkItemBranch: z.string().describe("Source branch name (required)"),
        TargetBranch: z.string().describe("Target branch name (required)"),
        DevopsProjectId: z.string().describe("DevOps project ID")
    }).describe("Work item object to check for conflicts. Use sf-devops-list-work-items to fetch work items first."),
    localPath: z.string().optional().describe("Local path to the repository (defaults to current working directory)")
});

type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsDetectConflictTool extends McpTool<InputArgsShape, OutputArgsShape> {
    private readonly action: DetectConflictAction;

    constructor(action: DetectConflictAction) {
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
        return "sf-devops-detect-conflict";
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Detect Merge Conflicts",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: undefined,
            annotations: {
                readOnlyHint: true,
            },
        };
    }

    public async exec(input: InputArgs): Promise<CallToolResult> {
        const detectInput: DetectConflictInput = {
            workItem: input.workItem as any,
            localPath: input.localPath
        };

        const result = await this.action.exec(detectInput);

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    hasConflicts: result.hasConflicts,
                    conflictedFiles: result.conflictedFiles,
                    message: result.message
                }, null, 2),
            }],
        };
    }
}
