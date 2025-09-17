/**
 * Represents a DevOps work item with all associated metadata.
 */
export interface WorkItem {
  id: string;
  name: string;
  subject?: string;
  status: string;
  owner: string;
  DevopsProjectId: string;
  PipelineId?: string;
  PipelineStageId?: string;
  Environment?: {
    Org_Id: string;
    Username: string;
    IsTestEnvironment: boolean;
  };
  SourceCodeRepository?: {
    repoUrl: string;
    repoType: string;
  };
  WorkItemBranch?: string;
  TargetStageId?: string;
  TargetBranch?: string;
} 