import { describe, it, expect, vi } from 'vitest';
import { fetchWorkItems, fetchWorkItemByName, fetchWorkItemsByNames } from '../src/getWorkItems.js';
import { getPipelineIdForProject, fetchPipelineStages } from '../src/shared/pipelineUtils.js';

vi.mock('../src/shared/pipelineUtils');

(getPipelineIdForProject as vi.Mock).mockResolvedValue('pipeline-001');
(fetchPipelineStages as vi.Mock).mockResolvedValue([{ Id: 'stage-001', Name: 'Stage 1' }]);

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
  })
};

describe('fetchWorkItems', () => {
  it('should fetch work items successfully', async () => {
    const workItems = await fetchWorkItems(mockConnection, 'project-001');
    expect(workItems).toHaveLength(1);
    expect(workItems[0].id).toBe('WI-0001');
  });

  it('should fetch a work item by name successfully', async () => {
    const workItem = await fetchWorkItemByName(mockConnection, 'WI-0001');
    expect(workItem?.id).toBe('WI-0001');
  });

});
