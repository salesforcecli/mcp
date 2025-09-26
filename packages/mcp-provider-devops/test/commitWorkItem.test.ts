import { describe, it, expect, vi } from 'vitest';
import { commitWorkItem } from '../src/commitWorkItem.js';
import { getConnection, getRequiredOrgs } from '../src/shared/auth.js';
import axios from 'axios';
import { execFileSync } from 'child_process';
import { normalizeAndValidateRepoPath } from '../src/shared/pathUtils.js';

vi.mock('../src/shared/auth');
vi.mock('axios');
vi.mock('child_process');
vi.mock('../src/shared/pathUtils');

(normalizeAndValidateRepoPath as vi.Mock).mockReturnValue('/mocked/path/to/repo');

describe('commitWorkItem', () => {
  it('should throw an error if org detection fails', async () => {
    (getRequiredOrgs as vi.Mock).mockResolvedValue({ error: 'Org detection failed' });

    await expect(commitWorkItem({
      workItem: { id: 'WI-0001' },
      requestId: 'req-001',
      commitMessage: 'Test commit',
      doceHubUsername: 'doceHubUser',
      sandboxUsername: 'sandboxUser',
      repoPath: '/path/to/repo'
    })).rejects.toThrow('Dual org detection failed: Org detection failed');
  });

  it('should commit work item successfully', async () => {
    const mockOrgs = { doceHub: { username: 'doceHubUser' }, sandbox: { username: 'sandboxUser' }, error: null };
    (getRequiredOrgs as vi.Mock).mockResolvedValue(mockOrgs);
    (getConnection as vi.Mock).mockResolvedValue({ accessToken: 'fake-token', instanceUrl: 'https://example.com' });
    (execFileSync as vi.Mock).mockReturnValue(JSON.stringify({ result: { files: [{ type: 'ApexClass', fullName: 'TestClass', filePath: 'classes/TestClass.cls' }] } }));
    (axios.post as vi.Mock).mockResolvedValue({ data: { id: 'commit-001' } });

    const result = await commitWorkItem({
      workItem: { id: 'WI-0001' },
      requestId: 'req-001',
      commitMessage: 'Test commit',
      doceHubUsername: 'doceHubUser',
      sandboxUsername: 'sandboxUser',
      repoPath: '/path/to/repo'
    });

    expect(result.success).toBe(true);
    expect(result.commitResult.id).toBe('commit-001');
  });

  it('should handle axios errors gracefully', async () => {
    const mockOrgs = { doceHub: { username: 'doceHubUser' }, sandbox: { username: 'sandboxUser' }, error: null };
    (getRequiredOrgs as vi.Mock).mockResolvedValue(mockOrgs);
    (getConnection as vi.Mock).mockResolvedValue({ accessToken: 'fake-token', instanceUrl: 'https://example.com' });
    (execFileSync as vi.Mock).mockReturnValue(JSON.stringify({ result: { files: [{ type: 'ApexClass', fullName: 'TestClass', filePath: 'classes/TestClass.cls' }] } }));
    (axios.post as vi.Mock).mockRejectedValue({ message: 'Network Error' });

    await expect(commitWorkItem({
      workItem: { id: 'WI-0001' },
      requestId: 'req-001',
      commitMessage: 'Test commit',
      doceHubUsername: 'doceHubUser',
      sandboxUsername: 'sandboxUser',
      repoPath: '/path/to/repo'
    })).rejects.toThrow('Failed to commit work item: Network Error');
  });
});
