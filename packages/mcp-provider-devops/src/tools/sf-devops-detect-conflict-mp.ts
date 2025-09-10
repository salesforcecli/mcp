import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    McpTool,
    McpToolConfig,
    ReleaseState,
    Toolset,
} from "@salesforce/mcp-provider-api";
import { DetectConflictMPAction, DetectConflictMPInput } from "../actions/detect-conflict-mp.js";

const DESCRIPTION = `Detects (and prepares to resolve) merge conflicts for a selected work item (Managed Package flow).

**When to use:**
- Managed Package DevOps user asks to detect conflicts for a work item or asks for help fixing a merge conflict.

**Input validation:**
- Provide a workItem. If not available, first list work items with 'sf-devops-list-work-items-mp' so the user can select one, then call this tool.
- Provide a workItem.TargetBranch. If not available, first call 'sf-devops-get-target-branch' to annotate the work item with the correct target branch, then call this tool again.

**What this tool does:**
1. Validates required properties (WorkItemBranch, TargetBranch, SourceCodeRepository.repoUrl)
2. Provides instructions to check for conflicts between the work item branch and target branch
3. Runs the necessary git commands to detect conflicts and surface findings

**Output:**
- If conflicts exist: lists conflicted files and suggested next steps
- If no conflicts: confirms it is safe to merge
- On error: returns details

**Next step:**
- After detection, call 'sf-devops-resolve-conflict-mp' to guide the user through conflict resolution.`;

const inputSchema = z.object({
    workItem: z.object({
        id: z.string().describe("Work item ID"),
        name: z.string().describe("Work item name"),
        status: z.string().describe("Work item status"),
        owner: z.string().describe("Work item owner"),
        DevopsProjectId: z.string().describe("DevOps project ID")
    }).describe("Work item object to check for conflicts. Use sf-devops-list-work-items-mp to fetch work items first."),
    localPath: z.string().optional().describe("Local path to the repository (defaults to current working directory)")
});

type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsDetectConflictMPTool extends McpTool<InputArgsShape, OutputArgsShape> {
    private readonly action: DetectConflictMPAction;

    constructor(action: DetectConflictMPAction) {
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
        return "sf-devops-detect-conflict-mp";
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Detect Merge Conflicts (MP)",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: undefined,
            annotations: {
                readOnlyHint: true,
            },
        };
    }

    public async exec(input: InputArgs): Promise<CallToolResult> {
        const detectInput: DetectConflictMPInput = {
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
