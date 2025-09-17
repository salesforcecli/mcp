import { McpProvider, McpTool, Services } from "@salesforce/mcp-provider-api";
import { SfDevopsListProjectsMcpTool } from "./tools/sf-devops-list-projects.js";
import { SfDevopsListWorkItemsMcpTool } from "./tools/sf-devops-list-work-items.js";
import { SfDevopsCreatePullRequestMcpTool } from "./tools/sf-devops-create-pull-request.js";
import { SfDevopsDetectConflictMcpTool } from "./tools/sf-devops-detect-conflict.js";
import { SfDevopsResolveConflictMcpTool } from "./tools/sf-devops-resolve-conflict.js";
import { SfDevopsPromoteWorkItemMcpTool } from "./tools/sf-devops-promote-work-item.js";
import { SfDevopsListOrgsMcpTool } from "./tools/sf-devops-list-orgs.js";
import { SfDevopsCommitWorkItemMcpTool } from "./tools/sf-devops-commit-work-item.js";
import { SfDevopsCheckCommitStatusMcpTool } from "./tools/sf-devops-check-commit-status.js";
import { SfDevopsCheckoutWorkItemMcpTool } from "./tools/sf-devops-checkout-work-item.js";

/**
 * MCP Provider for Salesforce DevOps Center operations.
 * 
 * Provides tools for managing DevOps workflows including work items, projects,
 * pull requests, conflict resolution, and deployment operations.
 */
export class DevOpsMcpProvider extends McpProvider {
  public getName(): string {
    return "DevOpsMcpProvider";
  }

  public provideTools(services: Services): Promise<McpTool[]> {
    return Promise.resolve([
      new SfDevopsListProjectsMcpTool(services),
      new SfDevopsListWorkItemsMcpTool(services),
      new SfDevopsCreatePullRequestMcpTool(services),
      new SfDevopsDetectConflictMcpTool(services),
      new SfDevopsResolveConflictMcpTool(services),
      new SfDevopsPromoteWorkItemMcpTool(services),
      new SfDevopsListOrgsMcpTool(services),
      new SfDevopsCommitWorkItemMcpTool(services),
      new SfDevopsCheckCommitStatusMcpTool(services),
      new SfDevopsCheckoutWorkItemMcpTool(services),
    ]);
  }
}
