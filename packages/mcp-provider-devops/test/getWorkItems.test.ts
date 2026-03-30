import { describe, it, expect, vi } from 'vitest';
import { fetchWorkItems, fetchWorkItemByName, fetchWorkItemsByNames } from '../src/getWorkItems.js';
import { getPipelineIdForProject, fetchPipelineStages } from '../src/shared/pipelineUtils.js';

vi.mock('../src/shared/pipelineUtils');

(getPipelineIdForProject as any).mockResolvedValue('pipeline-001');
(fetchPipelineStages as any).mockResolvedValue([{ Id: 'stage-001', Name: 'Stage 1' }]);

const mockConnection = {
  query: vi.fn().mockImplementation((query: string) => {
    if (query.includes("WHERE DevopsProjectId = 'project-001'")) {
      return { records: [{ Id: 'WI-0001', Name: 'Test Work Item' }] };
    }
    if (query.includes("WHERE Name IN ('WI-0001', 'WI-0002')")) {
      return { records: [{ Id: 'WI-0001', Name: 'Test Work Item' }, { Id: 'WI-0002', Name: 'Another Work Item' }] };
    }
    if (query.includes("WHERE Name = 'WI-0001'")) {
      return { records: [{ Id: 'WI-0001', Name: 'Test Work Item' }] };
    }
    return { records: [] };
  }),
  request: vi.fn().mockResolvedValue({ owner: 'acme-org' })
};

describe('fetchWorkItems', () => {
  it('should fetch work items successfully', async () => {
    const workItems = await fetchWorkItems(mockConnection as any, 'project-001');
    expect(workItems).toHaveLength(1);
    expect(workItems[0].id).toBe('WI-0001');
  });

  it('should fetch work items when no pipeline is linked to the project', async () => {
    (getPipelineIdForProject as any).mockResolvedValueOnce(undefined);
    const workItems = await fetchWorkItems(mockConnection as any, 'project-001');
    expect(workItems).toHaveLength(1);
    expect(workItems[0].id).toBe('WI-0001');
    expect(workItems[0].name).toBe('Test Work Item');
    expect(workItems[0].PipelineId).toBeUndefined();
    expect(workItems[0].TargetBranch).toBeUndefined();
    expect(workItems[0].TargetStageId).toBeUndefined();
    // Restore mock for other tests
    (getPipelineIdForProject as any).mockResolvedValue('pipeline-001');
  });

  it('should fetch a work item by name successfully', async () => {
    const workItem = await fetchWorkItemByName(mockConnection as any, 'WI-0001');
    expect(workItem?.id).toBe('WI-0001');
  });

  it('should fetch a work item by name when no pipeline is linked', async () => {
    (getPipelineIdForProject as any).mockResolvedValueOnce(undefined);
    const workItem = await fetchWorkItemByName(mockConnection as any, 'WI-0001');
    expect(workItem?.id).toBe('WI-0001');
    expect(workItem?.PipelineId).toBeUndefined();
    expect(workItem?.TargetBranch).toBeUndefined();
    expect(workItem?.TargetStageId).toBeUndefined();
  });

  it('should fetch work items by names even when no pipeline is linked', async () => {
    (getPipelineIdForProject as any).mockResolvedValueOnce(undefined);
    const workItems = await fetchWorkItemsByNames(mockConnection as any, ['WI-0001', 'WI-0002']);
    expect(workItems).toHaveLength(2);
    expect(workItems[0].id).toBe('WI-0001');
    expect(workItems[0].PipelineId).toBeUndefined();
    expect(workItems[1].id).toBe('WI-0002');
    expect(workItems[1].TargetBranch).toBeUndefined();
  });

  it('maps Bitbucket repository metadata from work items', async () => {
    const bitbucketConnection = {
      query: vi.fn().mockImplementation((query: string) => {
        if (query.includes("WHERE DevopsProjectId = 'project-bitbucket'")) {
          return {
            records: [{
              Id: 'WI-1001',
              Name: 'Bitbucket Item',
              DevopsProjectId: 'project-bitbucket',
              SourceCodeRepositoryBranch: {
                Name: 'feature/WI-1001',
                SourceCodeRepository: {
                  Name: 'test-repo',
                  RepositoryOwner: 'test-workspace',
                  Provider: 'bitbucket'
                }
              }
            }]
          };
        }
        return { records: [] };
      }),
      request: vi.fn().mockResolvedValue({ owner: 'workspace-from-connect-api' })
    };

    const workItems = await fetchWorkItems(bitbucketConnection as any, 'project-bitbucket');
    expect(workItems).toHaveLength(1);
    expect(workItems[0].SourceCodeRepository).toEqual({
      repoUrl: 'https://bitbucket.org/workspace-from-connect-api/test-repo',
      repoType: 'bitbucket'
    });
    expect(bitbucketConnection.request).toHaveBeenCalledWith({
      method: 'GET',
      url: '/services/data/v65.0/connect/devops/vcs/BITBUCKET'
    });
  });

  it('normalizes bitbucketcloud provider to bitbucket repoType', async () => {
    const bitbucketCloudConnection = {
      query: vi.fn().mockImplementation((query: string) => {
        if (query.includes("WHERE DevopsProjectId = 'project-bitbucket-cloud'")) {
          return {
            records: [{
              Id: 'WI-1002',
              Name: 'Bitbucket Cloud Item',
              DevopsProjectId: 'project-bitbucket-cloud',
              SourceCodeRepositoryBranch: {
                Name: 'feature/WI-1002',
                SourceCodeRepository: {
                  Name: 'cloud-repo',
                  RepositoryOwner: 'cloud-workspace',
                  Provider: 'bitbucketcloud'
                }
              }
            }]
          };
        }
        return { records: [] };
      }),
      request: vi.fn().mockResolvedValue({ owner: 'cloud-workspace-from-connect-api' })
    };

    const workItems = await fetchWorkItems(bitbucketCloudConnection as any, 'project-bitbucket-cloud');
    expect(workItems).toHaveLength(1);
    expect(workItems[0].SourceCodeRepository).toEqual({
      repoUrl: 'https://bitbucket.org/cloud-workspace-from-connect-api/cloud-repo',
      repoType: 'bitbucket'
    });
    expect(bitbucketCloudConnection.request).toHaveBeenCalledWith({
      method: 'GET',
      url: '/services/data/v65.0/connect/devops/vcs/BITBUCKET'
    });
  });

  it('uses GitHub owner from connect vcs API for repo URL', async () => {
    const githubConnection = {
      query: vi.fn().mockImplementation((query: string) => {
        if (query.includes("WHERE DevopsProjectId = 'project-github'")) {
          return {
            records: [{
              Id: 'WI-2001',
              Name: 'GitHub Item',
              DevopsProjectId: 'project-github',
              SourceCodeRepositoryBranch: {
                Name: 'feature/WI-2001',
                SourceCodeRepository: {
                  Name: 'repo-one',
                  RepositoryOwner: 'owner-from-soql',
                  Provider: 'github'
                }
              }
            }]
          };
        }
        return { records: [] };
      }),
      request: vi.fn().mockResolvedValue({ owner: 'owner-from-connect-api' })
    };

    const workItems = await fetchWorkItems(githubConnection as any, 'project-github');
    expect(workItems).toHaveLength(1);
    expect(workItems[0].SourceCodeRepository).toEqual({
      repoUrl: 'https://github.com/owner-from-connect-api/repo-one',
      repoType: 'github'
    });
    expect(githubConnection.request).toHaveBeenCalledWith({
      method: 'GET',
      url: '/services/data/v65.0/connect/devops/vcs/GITHUB'
    });
  });

});
