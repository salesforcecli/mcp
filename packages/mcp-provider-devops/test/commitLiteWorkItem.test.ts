import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { commitWorkItem } from '../src/commitLiteWorkItem.js';

import * as auth from '../src/shared/auth.js';
import * as pathUtils from '../src/shared/pathUtils.js';
import * as sfdxService from '../src/shared/sfdxService.js';
import axios from 'axios';
import { execFileSync } from 'child_process';

vi.mock('../src/shared/auth.js');
vi.mock('../src/shared/pathUtils.js');
vi.mock('../src/shared/sfdxService.js');
vi.mock('axios');
vi.mock('child_process');

describe('commitLiteWorkItem', () => {
  beforeEach(() => {
    (auth.getConnection as unknown as Mock).mockResolvedValue({ accessToken: 't', instanceUrl: 'https://example.com' });
    (pathUtils.normalizeAndValidateRepoPath as unknown as Mock).mockReturnValue('/repo');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when no eligible changes are detected', async () => {
    // deleted, modified, untracked, staged all empty
    (execFileSync as unknown as Mock)
      .mockImplementationOnce(() => '\n') // -d
      .mockImplementationOnce(() => '\n') // -m
      .mockImplementationOnce(() => '\n') // --others
      .mockImplementationOnce(() => '\n'); // --cached

    (sfdxService.convertToSourceComponents as unknown as Mock).mockReturnValue([]);

    await expect(
      commitWorkItem({
        workItem: { id: 'WI-1' },
        requestId: 'r1',
        commitMessage: 'msg',
        username: 'user',
        repoPath: '/repo'
      })
    ).rejects.toThrow('No eligible changes to commit');
  });

  it('posts computed changes and returns success payload', async () => {
    // deleted, modified, untracked, staged
    (execFileSync as unknown as Mock)
      .mockImplementationOnce(() => '\n') // -d
      .mockImplementationOnce(() => 'force-app/main/default/classes/A.cls\n') // -m
      .mockImplementationOnce(() => 'force-app/main/default/classes/B.cls\n') // --others
      .mockImplementationOnce(() => '\n') // --cached
      // git add --all
      .mockImplementationOnce(() => '')
      // git status --porcelain (non-empty string means there are changes)
      .mockImplementationOnce(() => ' M force-app/main/default/classes/A.cls')
      // git commit -m
      .mockImplementationOnce(() => '')
      // git rev-parse HEAD
      .mockImplementationOnce(() => 'abc123\n');

    (sfdxService.convertToSourceComponents as unknown as Mock).mockImplementation((baseDir: string, _reg: any, rels: string[]) => {
      return rels.map((rel: string) => ({ fullName: rel.endsWith('A.cls') ? 'A' : 'B', type: { name: 'ApexClass' }, filePath: baseDir + '/' + rel }));
    });

    (axios.post as unknown as Mock).mockResolvedValue({ data: { id: 'resp-1' } });

    const res = await commitWorkItem({
      workItem: { id: 'WI-2' },
      requestId: 'r2',
      commitMessage: 'feat: update',
      username: 'user',
      repoPath: '/repo'
    });

    expect(Array.isArray(res.content)).toBe(true);
    const joined = res.content.map((c: any) => c.text || '').join('\n');
    expect(joined).toMatch('Changes committed successfully');
    expect(joined).toMatch('Commit SHA: abc123');
  });
});


