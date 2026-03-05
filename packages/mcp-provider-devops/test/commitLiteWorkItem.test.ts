import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { commitWorkItem } from '../src/commitLiteWorkItem.js';

import * as pathUtils from '../src/shared/pathUtils.js';
import * as sfdxService from '../src/shared/sfdxService.js';
import { execFileSync } from 'child_process';

vi.mock('../src/shared/pathUtils.js');
vi.mock('../src/shared/sfdxService.js');
vi.mock('child_process');

describe('commitLiteWorkItem', () => {
  const mockConnection = { request: vi.fn(), query: vi.fn() };

  beforeEach(() => {
    (pathUtils.normalizeAndValidateRepoPath as unknown as Mock).mockReturnValue('/repo');
    mockConnection.request.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when no eligible changes are detected', async () => {
    (execFileSync as unknown as Mock)
      .mockImplementationOnce(() => '\n') // -d
      .mockImplementationOnce(() => '\n') // -m
      .mockImplementationOnce(() => '\n') // --others
      .mockImplementationOnce(() => '\n'); // --cached

    (sfdxService.convertToSourceComponents as unknown as Mock).mockReturnValue([]);

    await expect(
      commitWorkItem({
        connection: mockConnection as any,
        workItem: { id: 'WI-1' },
        requestId: 'r1',
        commitMessage: 'msg',
        repoPath: '/repo'
      })
    ).rejects.toThrow('No eligible changes to commit');
  });

  it('posts computed changes and returns success payload', async () => {
    (execFileSync as unknown as Mock)
      .mockImplementationOnce(() => '\n') // -d
      .mockImplementationOnce(() => 'force-app/main/default/classes/A.cls\n') // -m
      .mockImplementationOnce(() => 'force-app/main/default/classes/B.cls\n') // --others
      .mockImplementationOnce(() => '\n') // --cached
      .mockImplementationOnce(() => '') // git add --all
      .mockImplementationOnce(() => ' M force-app/main/default/classes/A.cls') // git status --porcelain
      .mockImplementationOnce(() => '') // git commit -m
      .mockImplementationOnce(() => 'abc123\n'); // git rev-parse HEAD

    (sfdxService.convertToSourceComponents as unknown as Mock).mockImplementation((baseDir: string, _reg: any, rels: string[]) => {
      return rels.map((rel: string) => ({ fullName: rel.endsWith('A.cls') ? 'A' : 'B', type: { name: 'ApexClass' }, filePath: baseDir + '/' + rel }));
    });

    mockConnection.request.mockResolvedValue(undefined);

    const res = await commitWorkItem({
      connection: mockConnection as any,
      workItem: { id: 'WI-2' },
      requestId: 'r2',
      commitMessage: 'feat: update',
      repoPath: '/repo'
    });

    expect(Array.isArray(res.content)).toBe(true);
    const joined = res.content.map((c: any) => c.text || '').join('\n');
    expect(joined).toMatch('Changes committed successfully');
    expect(joined).toMatch('Commit SHA: abc123');
    expect(mockConnection.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', url: expect.stringContaining('commitlite') })
    );
  });
});


