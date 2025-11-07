import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, TelemetryService } from "@salesforce/mcp-provider-api";
import { fetchProjects } from "../getProjects.js";
import { TelemetryEventNames } from "../constants.js";

const inputSchema = z.object({
  username: z.string().describe("Username of the DevOps Center org"),
});
type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsListProjects extends McpTool<InputArgsShape, OutputArgsShape> {
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
    return "list_devops_center_projects";
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "List DevOps Projects",
      description: `List all DevOps Center projects in a specific org
      
      **MANDATORY:** If the DevOps Center org is not given, use the 'list_all_orgs' tool to list all orgs. 
      The list will indicate which org is DevOps Center, or Sandbox if possible. If these details are not provided in the list, 
      ask the user to specify which org is DevOps Center org. Only proceed after the user has selected the DevOps Center org.

**MANDATORY:** Before using this tool, always confirm the selected org is the DevOps Center org. If not, prompt the user to select a DevOps Center org. This tool must NOT be used for any non DevOps Center or Sandbox orgs.

Lists DevOps Center Projects available in the specified org using SOQL on DevopsProject.

**Output:**
An array of project records with fields such as Id, Name, Description.`,
      inputSchema: inputSchema.shape,
      outputSchema: undefined,
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    const startTime = Date.now();
    
    try {
      const projects = await fetchProjects(input.username);
      
      const executionTime = Date.now() - startTime;
      const projectCount = projects.length;
      
      this.telemetryService.sendEvent(TelemetryEventNames.LIST_PROJECTS, {
        success: true,
        projectCount,
        executionTimeMs: executionTime,
      });
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(projects, null, 2)
        }]
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      this.telemetryService.sendEvent(TelemetryEventNames.LIST_PROJECTS, {
        success: false,
        error: error?.message || 'Unknown error',
        executionTimeMs: executionTime,
      });
      
      return {
        content: [{
          type: "text",
          text: `Error fetching projects: ${error?.message || error}`
        }],
        isError: true
      };
    }
  }
}
