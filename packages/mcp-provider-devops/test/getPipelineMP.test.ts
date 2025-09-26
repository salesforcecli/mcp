import { describe, it, expect, vi } from 'vitest';
import { getPipelineMP } from '../src/getPipelineMP.js';
import { getConnection } from '../src/shared/auth.js';

vi.mock('../src/shared/auth');

describe('getPipelineMP', () => {
  it('should fetch a pipeline successfully', async () => {
    const mockConnection = { query: vi.fn().mockResolvedValue({ records: [{ Id: 'PL-001', Name: 'Pipeline 1', sf_devops__Activated__c: true, sf_devops__Project__c: 'P-001' }] }) };
    (getConnection as vi.Mock).mockResolvedValue(mockConnection);

    const pipeline = await getPipelineMP('test-user', 'P-001');
    expect(pipeline.Id).toBe('PL-001');
    expect(pipeline.Name).toBe('Pipeline 1');
  });

  it('should return null if no active pipeline is found', async () => {
    const mockConnection = { query: vi.fn().mockResolvedValue({ records: [] }) };
    (getConnection as vi.Mock).mockResolvedValue(mockConnection);

    const pipeline = await getPipelineMP('test-user', 'P-001');
    expect(pipeline).toBeNull();
  });

  it('should handle errors gracefully', async () => {
    const mockConnection = { query: vi.fn().mockRejectedValue(new Error('Network Error')) };
    (getConnection as vi.Mock).mockResolvedValue(mockConnection);

    const error = await getPipelineMP('test-user', 'P-001');
    expect(error.message).toBe('Network Error');
  });
});
