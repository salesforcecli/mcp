import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    McpTool,
    McpToolConfig,
    ReleaseState,
    Toolset,
} from "@salesforce/mcp-provider-api";
import { ResolveConflictMPAction, ResolveConflictMPInput } from "../actions/resolve-conflict-mp.js";

const DESCRIPTION = `Resolves merge conflicts for a selected work item (Managed Package flow).

**When to use:**
- After running 'sf-devops-detect-conflict-mp' and conflicts were found.

**Input validation:**
- Provide a workItem. If not available, first list via 'sf-devops-list-work-items-mp' so the user can select one, then call this tool.
- Ensure the workItem includes:
  - WorkItemBranch (source branch name)
  - TargetBranch (target branch name). If not available, first call 'sf-devops-get-target-branch' to annotate the work item with the correct target branch, then call this tool again.
  - SourceCodeRepository.repoUrl (repo URL)

**What this tool does:**
1. Confirms the repo is in a conflicted state
2. Lists conflicted files
3. For each file, provides choices (keep current / keep incoming / keep both / manual) with exact git commands
4. Guides removing conflict markers, staging, and committing

**Output:**
- If conflicts exist: per-file action plan with commands
- If no conflicts: confirms the repo is clean
- On error: actionable troubleshooting

**Next step:**
- Re-run 'sf-devops-detect-conflict-mp' to verify, then promote or open a PR.`;

const inputSchema = z.object({
    workItem: z.object({
        id: z.string().describe("Work item ID"),
        name: z.string().describe("Work item name"),
        status: z.string().describe("Work item status"),
        owner: z.string().describe("Work item owner"),
        DevopsProjectId: z.string().describe("DevOps project ID")
    }).describe("Work item object to resolve conflicts for. Use sf-devops-detect-conflict-mp first; ensure WorkItemBranch and TargetBranch are present (use sf-devops-get-target-branch if needed)."),
    localPath: z.string().optional().describe("Local path to the repository (defaults to current working directory)")
});

type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsResolveConflictMPTool extends McpTool<InputArgsShape, OutputArgsShape> {
    private readonly action: ResolveConflictMPAction;

    constructor(action: ResolveConflictMPAction) {
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
        return "sf-devops-resolve-conflict-mp";
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Resolve Merge Conflicts (MP)",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: undefined,
            annotations: {
                readOnlyHint: false,
            },
        };
    }

    public async exec(input: InputArgs): Promise<CallToolResult> {
        const resolveInput: ResolveConflictMPInput = {
            workItem: input.workItem as any,
            localPath: input.localPath
        };

        const result = await this.action.exec(resolveInput);

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    success: result.success,
                    resolvedFiles: result.resolvedFiles,
                    message: result.message
                }, null, 2),
            }],
            isError: !result.success,
        };
    }
}
