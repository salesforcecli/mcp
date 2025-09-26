import { describe, it, expect, vi } from 'vitest';
import { createPullRequest } from '../src/createPullRequest.js';
import { getConnection } from '../src/shared/auth.js';
import axios from 'axios';

vi.mock('../src/shared/auth');
vi.mock('axios');

describe('createPullRequest', () => {
  it('should throw an error if workItemId is missing', async () => {
    await expect(createPullRequest({ workItemId: '', username: 'test-user' })).rejects.toThrow('Work item ID is required to create pull request.');
  });

  it('should throw an error if username is missing', async () => {
    await expect(createPullRequest({ workItemId: 'WI-0001', username: '' })).rejects.toThrow('Salesforce username is required to create pull request.');
  });

  it('should create a pull request successfully', async () => {
    const mockConnection = { accessToken: 'fake-token', instanceUrl: 'https://example.com' };
    (getConnection as vi.Mock).mockResolvedValue(mockConnection);
    (axios.post as vi.Mock).mockResolvedValue({ data: { id: 'PR-001' } });

    const result = await createPullRequest({ workItemId: 'WI-0001', username: 'test-user' });
    expect(result.success).toBe(true);
    expect(result.pullRequestResult.id).toBe('PR-001');
  });

  it('should handle axios errors gracefully', async () => {
    const mockConnection = { accessToken: 'fake-token', instanceUrl: 'https://example.com' };
    (getConnection as vi.Mock).mockResolvedValue(mockConnection);
    (axios.post as vi.Mock).mockRejectedValue({ message: 'Network Error' });

    await expect(createPullRequest({ workItemId: 'WI-0001', username: 'test-user' })).rejects.toThrow('Failed to create pull request: Network Error');
  });
});
