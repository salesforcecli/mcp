import { describe, it, expect, vi } from 'vitest';
import { promoteWorkItems } from '../src/promoteWorkItems.js';

describe('promoteWorkItems', () => {
  it('should promote work items successfully', async () => {
    const mockConnection = {
      request: vi.fn().mockResolvedValue({ requestId: '12345' })
    };

    const request = {
      workitems: [
        { id: 'WI-0001', PipelineStageId: 'PS-001', TargetStageId: 'TS-001', PipelineId: 'P-001' }
      ]
    };

    const response = await promoteWorkItems(mockConnection as any, request);
    expect(response.requestId).toBe('12345');
    expect(mockConnection.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', url: expect.stringContaining('promote') })
    );
  });

  it('should handle request errors gracefully', async () => {
    const mockConnection = {
      request: vi.fn().mockRejectedValue(new Error('Network Error'))
    };

    const request = {
      workitems: [
        { id: 'WI-0001', PipelineStageId: 'PS-001', TargetStageId: 'TS-001', PipelineId: 'P-001' }
      ]
    };

    const response = await promoteWorkItems(mockConnection as any, request);
    expect(response.error?.message).toBe('Network Error');
  });
});
