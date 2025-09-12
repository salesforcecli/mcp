import { McpProvider, McpTool, Services } from "@salesforce/mcp-provider-api";

// Tool imports for all 22 tools + example
import { SfDevopsListOrgsTool } from "./tools/sf-devops-list-orgs.js";
import { SfDevopsListProjectsTool } from "./tools/sf-devops-list-projects.js";
import { SfDevopsListWorkItemsTool } from "./tools/sf-devops-list-work-items.js";
import { SfDevopsCheckoutWorkItemTool } from "./tools/sf-devops-checkout-work-item.js";
import { SfDevopsGetChangesTool } from "./tools/sf-devops-get-changes.js";
import { SfDevopsCommitWorkItemTool } from "./tools/sf-devops-commit-work-item.js";
import { SfDevopsPromoteWorkItemTool } from "./tools/sf-devops-promote-work-item.js";
import { SfDevopsDeployProjectToOrgTool } from "./tools/sf-devops-deploy-project-to-org.js";
import { SfDevopsCheckCommitStatusTool } from "./tools/sf-devops-check-commit-status.js";
import { SfDevopsCreatePullRequestTool } from "./tools/sf-devops-create-pull-request.js";
import { SfDevopsCreateWorkItemTool } from "./tools/sf-devops-create-work-item.js";
import { SfDevopsListPipelinesTool } from "./tools/sf-devops-list-pipelines.js";
import { SfDevopsCreatePipelineTool } from "./tools/sf-devops-create-pipeline.js";
import { SfDevopsListWorkItemsMPTool } from "./tools/sf-devops-list-work-items-mp.js";
import { SfDevopsGetPipelineDetailsTool } from "./tools/sf-devops-get-pipeline-details.js";
import { SfDevopsGetTargetBranchTool } from "./tools/sf-devops-get-target-branch.js";
import { SfDevopsGetPipelineWithStagesTool } from "./tools/sf-devops-get-pipeline-with-stages.js";
import { SfDevopsPatchEnvironmentTool } from "./tools/sf-devops-patch-environment.js";
import { SfDevopsDetectConflictTool } from "./tools/sf-devops-detect-conflict.js";
import { SfDevopsResolveConflictTool } from "./tools/sf-devops-resolve-conflict.js";
import { SfDevopsDetectConflictMPTool } from "./tools/sf-devops-detect-conflict-mp.js";
import { SfDevopsResolveConflictMPTool } from "./tools/sf-devops-resolve-conflict-mp.js";

// Action imports for all 22 actions
import { ListOrgsActionImpl } from "./actions/list-orgs.js";
import { ListProjectsActionImpl } from "./actions/list-projects.js";
import { ListWorkItemsActionImpl } from "./actions/list-work-items.js";
import { CheckoutWorkItemActionImpl } from "./actions/checkout-work-item.js";
import { GetChangesActionImpl } from "./actions/get-changes.js";
import { CommitWorkItemActionImpl } from "./actions/commit-work-item.js";
import { PromoteWorkItemActionImpl } from "./actions/promote-work-item.js";
import { DeployProjectToOrgActionImpl } from "./actions/deploy-project-to-org.js";
import { CheckCommitStatusActionImpl } from "./actions/check-commit-status.js";
import { CreatePullRequestActionImpl } from "./actions/create-pull-request.js";
import { CreateWorkItemActionImpl } from "./actions/create-work-item.js";
import { ListPipelinesActionImpl } from "./actions/list-pipelines.js";
import { CreatePipelineActionImpl } from "./actions/create-pipeline.js";
import { ListWorkItemsMPActionImpl } from "./actions/list-work-items-mp.js";
import { GetPipelineDetailsActionImpl } from "./actions/get-pipeline-details.js";
import { GetTargetBranchActionImpl } from "./actions/get-target-branch.js";
import { GetPipelineWithStagesActionImpl } from "./actions/get-pipeline-with-stages.js";
import { PatchEnvironmentActionImpl } from "./actions/patch-environment.js";
import { DetectConflictActionImpl } from "./actions/detect-conflict.js";
import { ResolveConflictActionImpl } from "./actions/resolve-conflict.js";
import { DetectConflictMPActionImpl } from "./actions/detect-conflict-mp.js";
import { ResolveConflictMPActionImpl } from "./actions/resolve-conflict-mp.js";

/**
 * MCP Provider for DevOps operations and tooling
 */
export class DevOpsMcpProvider extends McpProvider {
  public getName(): string {
    return "DevOpsMcpProvider";
  }

  public provideTools(services: Services): Promise<McpTool[]> {
    const telemetryService = services.getTelemetryService();

    return Promise.resolve([
      // Core foundational tools
      new SfDevopsListOrgsTool(new ListOrgsActionImpl({ telemetryService })),
      new SfDevopsListProjectsTool(new ListProjectsActionImpl({ telemetryService })),
      new SfDevopsListWorkItemsTool(new ListWorkItemsActionImpl({ telemetryService })),
      new SfDevopsListPipelinesTool(new ListPipelinesActionImpl({ telemetryService })),

      // Core workflow tools
      new SfDevopsCheckoutWorkItemTool(new CheckoutWorkItemActionImpl({ telemetryService })),
      new SfDevopsGetChangesTool(new GetChangesActionImpl({ telemetryService })),
      new SfDevopsCommitWorkItemTool(new CommitWorkItemActionImpl({ telemetryService })),
      new SfDevopsPromoteWorkItemTool(new PromoteWorkItemActionImpl({ telemetryService })),

      // Additional DevOps tools
      new SfDevopsDeployProjectToOrgTool(new DeployProjectToOrgActionImpl({ telemetryService })),
      new SfDevopsCheckCommitStatusTool(new CheckCommitStatusActionImpl({ telemetryService })),
      new SfDevopsCreatePullRequestTool(new CreatePullRequestActionImpl({ telemetryService })),
      new SfDevopsCreateWorkItemTool(new CreateWorkItemActionImpl({ telemetryService })),

      // Advanced pipeline and workflow tools
      new SfDevopsCreatePipelineTool(new CreatePipelineActionImpl({ telemetryService })),
      new SfDevopsGetPipelineDetailsTool(new GetPipelineDetailsActionImpl({ telemetryService })),
      new SfDevopsGetTargetBranchTool(new GetTargetBranchActionImpl({ telemetryService })),
      new SfDevopsListWorkItemsMPTool(new ListWorkItemsMPActionImpl({ telemetryService })),

      // Advanced tools - remaining 6
      new SfDevopsGetPipelineWithStagesTool(new GetPipelineWithStagesActionImpl({ telemetryService })),
      new SfDevopsPatchEnvironmentTool(new PatchEnvironmentActionImpl({ telemetryService })),
      new SfDevopsDetectConflictTool(new DetectConflictActionImpl({ telemetryService })),
      new SfDevopsResolveConflictTool(new ResolveConflictActionImpl({ telemetryService })),
      new SfDevopsDetectConflictMPTool(new DetectConflictMPActionImpl({ telemetryService })),
      new SfDevopsResolveConflictMPTool(new ResolveConflictMPActionImpl({ telemetryService })),

      // ✅ ALL 22 DEVOPS TOOLS NOW REGISTERED! 🎉
    ]);
  }
}
