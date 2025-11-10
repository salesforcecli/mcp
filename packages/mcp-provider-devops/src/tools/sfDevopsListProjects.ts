import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, TelemetryService } from "@salesforce/mcp-provider-api";
import { fetchProjects } from "../getProjects.js";
import { TelemetryEventNames } from "../constants.js";

const inputSchema = z.object({
  username: z.string().optional().describe("Username of the DevOps Center org"),
  alias: z.string().optional().describe("alias of the DevOps Center org"),
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

**Input:**
- Either username (example devops-center@example.com) or alias (example myDevOpsOrg) is required.

Lists DevOps Center Projects available in the specified org using SOQL on DevopsProject.

**Output:**
An array of project records with fields such as Id, Name, Description.`,
      inputSchema: inputSchema.shape,
      outputSchema: undefined,
    };
  }

  private validateAndPrepare(input: InputArgs): { usernameOrAlias: string } | { error: CallToolResult } {
    if (!input.username && !input.alias) {
      return {
        error: {
          content: [{ type: "text", text: `Error: Username or alias of valid DevOps Center org is required` }],
          isError: true
        }
      };
    }

    const usernameOrAlias = input.username ?? input.alias;
    if (!usernameOrAlias) {
      return {
        error: {
          content: [{ type: "text", text: `Error: Username or alias of valid DevOps Center org is required` }],
          isError: true
        }
      };
    }

    return { usernameOrAlias };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    const startTime = Date.now();
    
    const validation = this.validateAndPrepare(input);
    if ("error" in validation) {
      return validation.error;
    }

    const { usernameOrAlias } = validation;
    
    try {
      const projects = await fetchProjects(usernameOrAlias);
      
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
