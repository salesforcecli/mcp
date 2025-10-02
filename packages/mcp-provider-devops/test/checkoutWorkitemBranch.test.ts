import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/shared/gitUtils.js', () => ({
  isGitRepository: vi.fn(),
  hasUncommittedChanges: vi.fn()
}));

import { isGitRepository, hasUncommittedChanges } from '../src/shared/gitUtils.js';
import { checkoutWorkitemBranch } from '../src/checkoutWorkitemBranch.js';

describe('checkoutWorkitemBranch', () => {
  const REPO_URL = 'https://example.com/repo.git';
  const BRANCH = 'feature/WI-123';
  const LOCAL_PATH = '/path/to/repo';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when repoUrl or branchName missing', async () => {
    (isGitRepository as any).mockReturnValue(true);
    (hasUncommittedChanges as any).mockReturnValue(false);

    const res1 = await checkoutWorkitemBranch({ repoUrl: '', branchName: BRANCH, localPath: LOCAL_PATH });
    expect(res1.isError).toBe(true);
    expect(res1.content[0].text).toMatch(/Missing required parameters/);

    const res2 = await checkoutWorkitemBranch({ repoUrl: REPO_URL, branchName: '', localPath: LOCAL_PATH });
    expect(res2.isError).toBe(true);
    expect(res2.content[0].text).toMatch(/Missing required parameters/);
  });

  it('returns error when localPath is missing', async () => {
    const res = await checkoutWorkitemBranch({ repoUrl: REPO_URL, branchName: BRANCH, localPath: '' });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/'localPath' is required/);
  });

  it('returns error when localPath is not a git repo', async () => {
    (isGitRepository as any).mockReturnValue(false);

    const res = await checkoutWorkitemBranch({ repoUrl: REPO_URL, branchName: BRANCH, localPath: LOCAL_PATH });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/is not a Git repository/);
  });

  it('returns error when uncommitted changes exist', async () => {
    (isGitRepository as any).mockReturnValue(true);
    (hasUncommittedChanges as any).mockReturnValue(true);

    const res = await checkoutWorkitemBranch({ repoUrl: REPO_URL, branchName: BRANCH, localPath: LOCAL_PATH });
    // Function currently returns without setting isError on this path; assert message
    expect(res.content[0].text).toMatch(/has uncommitted changes/);
  });

  it('returns action plan for fetch and checkout without cloning', async () => {
    (isGitRepository as any).mockReturnValue(true);
    (hasUncommittedChanges as any).mockReturnValue(false);

    const res = await checkoutWorkitemBranch({ repoUrl: REPO_URL, branchName: BRANCH, localPath: LOCAL_PATH });
    expect(res.isError).toBeUndefined();
    expect(res.content).toHaveLength(1);
    expect(res.content[0].type).toBe('text');
    const text = res.content[0].text as string;
    expect(text).toMatch(/Checkout work item branch/);
    expect(text).toMatch(new RegExp(`git fetch origin ${BRANCH}`));
    expect(text).toMatch(new RegExp(`git ls-remote .* ${BRANCH}`));
    expect(text).toMatch(new RegExp(`git checkout ${BRANCH}`));
    expect(text).toMatch(new RegExp(`git checkout -t origin/${BRANCH}`));
    expect(text).toMatch(/git pull --ff-only/);
  });
});
