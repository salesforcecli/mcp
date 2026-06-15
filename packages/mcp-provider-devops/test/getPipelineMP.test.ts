import { describe, it, expect, vi } from 'vitest';
import { getPipelineMP } from '../src/getPipelineMP.js';

describe('getPipelineMP', () => {
  it('should fetch a pipeline successfully', async () => {
    const mockConnection = { query: vi.fn().mockResolvedValue({ records: [{ Id: 'PL-001', Name: 'Pipeline 1', sf_devops__Activated__c: true, sf_devops__Project__c: 'a0Bxx00000002Cd' }] }) };

    const pipeline = await getPipelineMP(mockConnection, 'a0Bxx00000002Cd');
    expect(pipeline.Id).toBe('PL-001');
    expect(pipeline.Name).toBe('Pipeline 1');
  });

  it('should return null if no active pipeline is found', async () => {
    const mockConnection = { query: vi.fn().mockResolvedValue({ records: [] }) };

    const pipeline = await getPipelineMP(mockConnection, 'a0Bxx00000002Cd');
    expect(pipeline).toBeNull();
  });

  it('should handle errors gracefully', async () => {
    const mockConnection = { query: vi.fn().mockRejectedValue(new Error('Network Error')) };

    const error = await getPipelineMP(mockConnection, 'a0Bxx00000002Cd');
    expect(error.message).toBe('Network Error');
  });
});
