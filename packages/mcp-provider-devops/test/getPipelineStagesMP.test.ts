import { describe, it, expect, vi } from 'vitest';
import { fetchPipelineStagesMP } from '../src/getPipelineStagesMP.js';
import { getConnection } from '../src/shared/auth.js';

vi.mock('../src/shared/auth');

describe('fetchPipelineStagesMP', () => {
  it('should fetch pipeline stages successfully', async () => {
    const mockConnection = { query: vi.fn().mockResolvedValue({ records: [{ Id: 'PS-001', Name: 'Stage 1', sf_devops__Pipeline__c: 'P-001' }] }) };
    (getConnection as vi.Mock).mockResolvedValue(mockConnection);

    const stages = await fetchPipelineStagesMP('test-user', 'P-001');
    expect(stages).toHaveLength(1);
    expect(stages[0].Id).toBe('PS-001');
    expect(stages[0].Name).toBe('Stage 1');
  });

  it('should return an empty array if no stages are found', async () => {
    const mockConnection = { query: vi.fn().mockResolvedValue({ records: [] }) };
    (getConnection as vi.Mock).mockResolvedValue(mockConnection);

    const stages = await fetchPipelineStagesMP('test-user', 'P-001');
    expect(stages).toHaveLength(0);
  });

  it('should handle errors gracefully', async () => {
    const mockConnection = { query: vi.fn().mockRejectedValue(new Error('Network Error')) };
    (getConnection as vi.Mock).mockResolvedValue(mockConnection);

    const error = await fetchPipelineStagesMP('test-user', 'P-001');
    expect(error.message).toBe('Network Error');
  });
});
