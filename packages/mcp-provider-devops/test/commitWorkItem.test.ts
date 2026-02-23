import { describe, it, expect, vi } from 'vitest';
import { commitWorkItem } from '../src/commitWorkItem.js';
import { execFileSync } from 'child_process';
import { normalizeAndValidateRepoPath } from '../src/shared/pathUtils.js';

vi.mock('child_process');
vi.mock('../src/shared/pathUtils');

(normalizeAndValidateRepoPath as vi.Mock).mockReturnValue('/mocked/path/to/repo');

describe('commitWorkItem', () => {
  const mockDevHubConnection = { request: vi.fn(), accessToken: 'devhub-token', instanceUrl: 'https://devhub.example.com' };
  const mockSandboxConnection = { accessToken: 'sandbox-token', instanceUrl: 'https://sandbox.example.com' };

  it('should throw an error when no changes are detected', async () => {
    (execFileSync as vi.Mock).mockReturnValue(JSON.stringify({ result: { details: { componentSuccesses: [] } } }));

    await expect(commitWorkItem({
      devHubConnection: mockDevHubConnection as any,
      sandboxConnection: mockSandboxConnection as any,
      sandboxUsername: 'sandboxUser',
      workItem: { id: 'WI-0001' },
      requestId: 'req-001',
      commitMessage: 'Test commit',
      repoPath: '/path/to/repo'
    })).rejects.toThrow('Deployment returned no component details. Ensure there are changes under force-app.');
  });

  it('should commit successfully when changes exist', async () => {
    (execFileSync as vi.Mock)
      .mockReturnValueOnce(JSON.stringify({
        result: {
          details: {
            componentSuccesses: [
              { componentType: 'ApexClass', fullName: 'MyClass', fileName: 'classes/MyClass.cls' }
            ]
          }
        }
      }))
      .mockReturnValueOnce('') // git ls-files -d
      .mockReturnValueOnce('force-app/main/default/classes/MyClass.cls') // git ls-files -m
      .mockReturnValueOnce('')
      .mockReturnValueOnce('')
      .mockReturnValueOnce('');
    mockDevHubConnection.request.mockResolvedValue({ id: 'commit-1' });

    const result = await commitWorkItem({
      devHubConnection: mockDevHubConnection as any,
      sandboxConnection: mockSandboxConnection as any,
      sandboxUsername: 'sandboxUser',
      workItem: { id: 'WI-0001' },
      requestId: 'req-001',
      commitMessage: 'Test commit',
      repoPath: '/path/to/repo'
    });

    expect(result.success).toBe(true);
    expect(result.trace.changesCount).toBe(1);
    expect(mockDevHubConnection.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', url: expect.stringContaining('commit') })
    );
  });
});