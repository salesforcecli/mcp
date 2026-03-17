import { describe, it, expect, vi } from 'vitest';
import { createPullRequest } from '../src/createPullRequest.js';

describe('createPullRequest', () => {
  it('should throw an error if workItemId is missing', async () => {
    const mockConnection = { request: vi.fn() };
    await expect(createPullRequest(mockConnection as any, '')).rejects.toThrow('Work item ID is required to create pull request.');
  });

  it('should create a pull request successfully', async () => {
    const mockConnection = {
      request: vi.fn().mockResolvedValue({ id: 'PR-001' })
    };

    const result = await createPullRequest(mockConnection as any, 'WI-0001');
    expect(result.success).toBe(true);
    expect(result.pullRequestResult.id).toBe('PR-001');
    expect(mockConnection.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', url: expect.stringContaining('review') })
    );
  });

  it('should handle request errors gracefully', async () => {
    const mockConnection = {
      request: vi.fn().mockRejectedValue(new Error('Network Error'))
    };

    await expect(createPullRequest(mockConnection as any, 'WI-0001')).rejects.toThrow('Failed to create pull request: Network Error');
  });
});
