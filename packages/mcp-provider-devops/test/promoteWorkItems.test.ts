import { describe, it, expect, vi } from 'vitest';
import { promoteWorkItems } from '../src/promoteWorkItems.js';
import { getConnection } from '../src/shared/auth.js';
import axios from 'axios';

vi.mock('../src/shared/auth');
vi.mock('axios');

describe('promoteWorkItems', () => {
  it('should promote work items successfully', async () => {
    const mockConnection = { accessToken: 'fake-token', instanceUrl: 'https://example.com' };
    (getConnection as vi.Mock).mockResolvedValue(mockConnection);
    (axios.post as vi.Mock).mockResolvedValue({ data: { requestId: '12345' } });

    const request = {
      workitems: [
        { id: 'WI-0001', PipelineStageId: 'PS-001', TargetStageId: 'TS-001', PipelineId: 'P-001' }
      ]
    };

    const response = await promoteWorkItems('test-user', request);
    expect(response.requestId).toBe('12345');
  });

  it('should return an error if access token or instance URL is missing', async () => {
    (getConnection as vi.Mock).mockResolvedValue({ accessToken: null, instanceUrl: null });

    const request = {
      workitems: [
        { id: 'WI-0001', PipelineStageId: 'PS-001', TargetStageId: 'TS-001', PipelineId: 'P-001' }
      ]
    };

    await expect(promoteWorkItems('test-user', request)).rejects.toThrow('Missing access token or instance URL.');
  });

  it('should handle axios errors gracefully', async () => {
    const mockConnection = { accessToken: 'fake-token', instanceUrl: 'https://example.com' };
    (getConnection as vi.Mock).mockResolvedValue(mockConnection);
    (axios.post as vi.Mock).mockRejectedValue({ message: 'Network Error' });

    const request = {
      workitems: [
        { id: 'WI-0001', PipelineStageId: 'PS-001', TargetStageId: 'TS-001', PipelineId: 'P-001' }
      ]
    };

    const response = await promoteWorkItems('test-user', request);
    expect(response.error?.message).toBe('Network Error');
  });
});
