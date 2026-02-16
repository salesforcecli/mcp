import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, Services } from "@salesforce/mcp-provider-api";
import { createWorkItem } from "../createWorkItem.js";
import { TelemetryEventNames } from "../constants.js";
import { usernameOrAliasParam } from "../shared/params.js";

const inputSchema = z.object({
  usernameOrAlias: usernameOrAliasParam,
  projectId: z.string().min(1).describe("DevOps Center Project ID selected from list_devops_center_projects for the same org."),
  subject: z.string().min(1).describe("Work item subject."),
  description: z.string().describe("Work item description."),
});
type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsCreateWorkItem extends McpTool<InputArgsShape, OutputArgsShape> {
  private readonly services: Services;

  constructor(services: Services) {
    super();
    this.services = services;
  }

  public getReleaseState(): ReleaseState {
    return ReleaseState.NON_GA;
  }

  public getToolsets(): Toolset[] {
    return [Toolset.DEVOPS];
  }

  public getName(): string {
    return "create_devops_center_work_item";
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Create Work Item",
      description: `Creates a new DevOps Center Work Item in the specified project.

**Usage notes:**
- This tool must be used for the DevOps Center org only. If the org is not provided, use 'list_all_orgs' to select the DevOps Center org.
- A DevOps Center project must be selected first from the same org. If the projectId is not known, call 'list_devops_center_projects' for that org and ask the user to select a project. Use that project's Id here.
- Ensure the org used to select the project is the same org passed to this tool.
- (**Mandatory) Always ask the user to give the work item subject. Don't proceed until the user has provided the subject.(**Mandatory**)**

**API:** POST /services/data/v65.0/connect/devops/projects/<ProjectID>/workitem
**Body:** { "subject": string, "description": string }

**Input parameters:**
- usernameOrAlias: DevOps Center org username or alias. If missing, use 'list_all_orgs' and ask user to select the DevOps Center org.
- projectId: DevOps Center Project ID from list_devops_center_projects for the same org.
- subject: Work item subject.
- description: Work item description.

**Output:**
- success: Whether the create succeeded.
- workItemId, workItemName, subject: Created work item details on success.
- error: Error message if the create failed.`,
      inputSchema: inputSchema.shape,
      outputSchema: undefined,
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    const startTime = Date.now();

    try {
      const result = await createWorkItem({
        usernameOrAlias: input.usernameOrAlias,
        projectId: input.projectId,
        subject: input.subject,
        description: input.description,
      });

      const executionTime = Date.now() - startTime;

      this.services.getTelemetryService().sendEvent(TelemetryEventNames.CREATE_WORK_ITEM, {
        success: result.success,
        projectId: input.projectId,
        executionTimeMs: executionTime,
        ...(result.error && { error: result.error }),
      });

      if (!result.success) {
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e: any) {
      const executionTime = Date.now() - startTime;

      this.services.getTelemetryService().sendEvent(TelemetryEventNames.CREATE_WORK_ITEM, {
        success: false,
        error: e?.message || "Unknown error",
        projectId: input.projectId,
        executionTimeMs: executionTime,
      });

      return {
        content: [{ type: "text", text: `Error creating work item: ${e?.message || e}` }],
        isError: true,
      };
    }
  }
}
