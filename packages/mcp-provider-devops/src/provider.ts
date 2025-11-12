import { McpProvider, McpTool, Services } from "@salesforce/mcp-provider-api";
import { SfDevopsListProjects } from "./tools/sfDevopsListProjects.js";
import { SfDevopsListWorkItems } from "./tools/sfDevopsListWorkItems.js";
import { SfDevopsPromoteWorkItem } from "./tools/sfDevopsPromoteWorkItem.js";
import { SfDevopsDetectConflict } from "./tools/sfDevopsDetectConflict.js";
import { SfDevopsResolveConflict } from "./tools/sfDevopsResolveConflict.js";
import { CheckCommitStatus } from "./tools/checkCommitStatus.js";
import { CreatePullRequest } from "./tools/createPullRequest.js";
import { SfDevopsCheckoutWorkItem } from "./tools/sfDevopsCheckoutWorkItem.js";
import { SfDevopsCommitWorkItem } from "./tools/sfDevopsCommitWorkItem.js";

/**
 * DevOps MCPProvider for DevOps tools and operations
 */
export class DevOpsMcpProvider extends McpProvider {
  public getName(): string {
    return "DevOpsMcpProvider";
  }

  public provideTools(services: Services): Promise<McpTool[]> {
    const telemetryService = services.getTelemetryService();
    return Promise.resolve([
      new SfDevopsListProjects(services),
      new SfDevopsListWorkItems(telemetryService),
      new SfDevopsPromoteWorkItem(telemetryService),
      new SfDevopsDetectConflict(telemetryService),
      new SfDevopsResolveConflict(telemetryService),

      new SfDevopsCheckoutWorkItem(telemetryService),
      new SfDevopsCommitWorkItem(telemetryService),

      new CheckCommitStatus(telemetryService),
      new CreatePullRequest(telemetryService),
    ]);
  }

}