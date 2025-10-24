import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, TelemetryService } from "@salesforce/mcp-provider-api";
import { fetchWorkItems } from "../getWorkItems.js";

const inputSchema = z.object({
  username: z.string().describe("Username of the DevOps Center org"),
  project: z.object({
    Id: z.string().describe("Selected project's Id"),
    Name: z.string().optional()
  }).describe("DevOps project selected from list_devops_center_projects for the same org"),
});
type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsListWorkItems extends McpTool<InputArgsShape, OutputArgsShape> {
  private readonly telemetryService: TelemetryService;

  constructor(telemetryService: TelemetryService) {
    super();
    this.telemetryService = telemetryService;
  }

  public getReleaseState(): ReleaseState {
    return ReleaseState.NON_GA;
  }

  public getToolsets(): Toolset[] {
    return [Toolset.DEVOPS];
  }

  public getName(): string {
    return "list_devops_center_work_items";
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "List DevOps Work Items",
      description: `List all the work items for a specific  DevOps Center project.
      **MANDATORY:** If the DevOps Center org is not given, use the 'sf-list-all-orgs' tool to list all orgs. 
      The list will indicate which org is DevOps Center, or Sandbox if possible. If these details are not provided in the list, 
      ask the user to specify which org is DevOps Center org. Only proceed after the user has selected the DevOps Center org.

      **MANDATORY:** Before using this tool, always confirm the selected org is the DevOps Center org. If not, prompt the user to select a DevOps Center org. This tool must NOT be used for any non DevOps Center or Sandbox orgs.

      **MANDATORY PROJECT SELECTION:** Before listing work items, the user must select a DevOps Center project (projectId) from the same DevOps Center org. First call 'list_devops_center_projects' for that org, then pass the selected project's Id here. The org used here must match the org used to fetch the projects.

      Lists work items from a Salesforce DevOps Center project. Each work item includes branch, environment, and repository details needed for checkout and promotion.

      **After using this tool, always suggest the user with the next actions:**
      **LLM should strictly suggest only these two options:**
      1. Start work on the work item (use the 'checkout_devops_center_work_item' tool)
      2. Promote work items (use the 'promote_devops_center_work_item' tool)`,
      inputSchema: inputSchema.shape,
      outputSchema: undefined,
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    try {
      const workItems = await fetchWorkItems(input.username, input.project.Id);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(workItems, null, 2)
        }]
      };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `Error listing work items: ${e?.message || e}` }],
        isError: true
      };
    }
  }
}
