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
});


