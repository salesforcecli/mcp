import { describe, it, expect, vi } from 'vitest';
import { fetchWorkItemByNameMP } from '../src/getWorkItemsMP.js';
import { getConnection } from '../src/shared/auth.js';

vi.mock('../src/shared/auth');

describe('fetchWorkItemByNameMP', () => {
  it('should return a work item successfully', async () => {
    const mockConnection = { query: vi.fn().mockResolvedValue({ records: [{ Id: 'WI-0001', Name: 'Test Work Item' }] }) };
    (getConnection as vi.Mock).mockResolvedValue(mockConnection);

    const workItem = await fetchWorkItemByNameMP('test-user', 'WI-0001');
    expect(workItem.id).toBe('WI-0001');
    expect(workItem.name).toBe('Test Work Item');
  });

  it('should return an error if work item is concluded', async () => {
    const mockConnection = { query: vi.fn().mockResolvedValue({ records: [{ Id: 'WI-0001', Name: 'Test Work Item', sf_devops__Concluded__c: 'true' }] }) };
    (getConnection as vi.Mock).mockResolvedValue(mockConnection);

    const result = await fetchWorkItemByNameMP('test-user', 'WI-0001');
    expect(result.error.message).toContain('is concluded. No further actions required.');
  });

  it('should return an error if work item is not found', async () => {
    const mockConnection = { query: vi.fn().mockResolvedValue({ records: [] }) };
    (getConnection as vi.Mock).mockResolvedValue(mockConnection);

    const result = await fetchWorkItemByNameMP('test-user', 'WI-0001');
    expect(result.error.message).toContain('Work Item \'WI-0001\' not found.');
  });
});
