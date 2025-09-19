export interface WorkItem {
  id: string;
  name: string; // Salesforce record Name
  subject?: string; // Work item subject/title
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