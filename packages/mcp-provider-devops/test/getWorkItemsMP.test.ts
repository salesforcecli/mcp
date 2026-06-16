import { describe, it, expect, vi } from 'vitest';
import { fetchWorkItemByNameMP } from '../src/getWorkItemsMP.js';

function createMockConnection(workItemRecord: any, pipelineRecord: any, stagesRecords: any[], promoteRecords: any[] = []) {
  return {
    query: vi.fn().mockImplementation((query: string) => {
      if (query.includes('sf_devops__Work_Item__c') && query.includes('WHERE Name =')) {
        return Promise.resolve({ records: workItemRecord ? [workItemRecord] : [] });
      }
      if (query.includes('sf_devops__Pipeline__c')) {
        return Promise.resolve({ records: pipelineRecord ? [pipelineRecord] : [] });
      }
      if (query.includes('sf_devops__Pipeline_Stage__c')) {
        return Promise.resolve({ records: stagesRecords });
      }
      if (query.includes('sf_devops__Work_Item_Promote__c')) {
        return Promise.resolve({ records: promoteRecords });
      }
      return Promise.resolve({ records: [] });
    })
  };
}

describe('fetchWorkItemByNameMP', () => {
  it('should return a work item successfully', async () => {
    const workItemRecord = { Id: 'a07xx0000000001', Name: 'Test Work Item', sf_devops__Project__c: 'a0Bxx00000002Cd' };
    const pipelineRecord = { Id: 'a0Axx00000001Ab', Name: 'Pipeline 1', sf_devops__Project__c: 'a0Bxx00000002Cd' };
    const stagesRecords = [{ Id: 'a08xx0000000001', Name: 'Stage 1', sf_devops__Next_Stage__c: null }];
    const mockConnection = createMockConnection(workItemRecord, pipelineRecord, stagesRecords);

    const workItem = await fetchWorkItemByNameMP(mockConnection, 'WI-0001');
    expect(workItem.id).toBe('a07xx0000000001');
    expect(workItem.name).toBe('Test Work Item');
  });

  it('infers bitbucket repoType from managed package repository URL', async () => {
    const workItemRecord = {
      Id: 'a07xx0000000002',
      Name: 'Test Work Item',
      sf_devops__Project__c: 'a0Bxx00000002Cd',
      sf_devops__Branch__r: {
        sf_devops__Repository__r: {
          sf_devops__Url__c: 'https://bitbucket.org/acme/project-repo.git'
        }
      }
    };
    const pipelineRecord = { Id: 'a0Axx00000001Ab', Name: 'Pipeline 1', sf_devops__Project__c: 'a0Bxx00000002Cd' };
    const stagesRecords = [{ Id: 'a08xx0000000001', Name: 'Stage 1', sf_devops__Next_Stage__c: null }];
    const mockConnection = createMockConnection(workItemRecord, pipelineRecord, stagesRecords);

    const workItem = await fetchWorkItemByNameMP(mockConnection as any, 'WI-0001');
    expect(workItem.SourceCodeRepository.repoType).toBe('bitbucket');
  });

  it('should return an error if work item is concluded', async () => {
    const workItemRecord = { Id: 'a07xx0000000003', Name: 'Test Work Item', sf_devops__Concluded__c: 'true', sf_devops__Project__c: 'a0Bxx00000002Cd' };
    const pipelineRecord = { Id: 'a0Axx00000001Ab', Name: 'Pipeline 1', sf_devops__Project__c: 'a0Bxx00000002Cd' };
    const stagesRecords = [{ Id: 'a08xx0000000001', Name: 'Stage 1' }];
    const mockConnection = createMockConnection(workItemRecord, pipelineRecord, stagesRecords);

    const result = await fetchWorkItemByNameMP(mockConnection, 'WI-0001');
    expect(result.error.message).toContain('is concluded. No further actions required.');
  });

  it('should return an error if work item is not found', async () => {
    const mockConnection = createMockConnection(null, null, []);

    const result = await fetchWorkItemByNameMP(mockConnection, 'WI-0001');
    expect(result.error.message).toContain('Work Item \'WI-0001\' not found.');
  });
});
