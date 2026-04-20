import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execSync } from 'node:child_process';
import { isSameGitRepo, validateGitBranchName } from '../../src/shared/gitUtils.js';

vi.mock('node:child_process', () => ({
  execSync: vi.fn()
}));

describe('shared/gitUtils', () => {
  beforeEach(() => {
    vi.mocked(execSync).mockImplementation((command: string) => {
      if (command.includes('git remote get-url origin')) {
        return Buffer.from('https://aditishreya2929@bitbucket.org/practice-sf-101/bitbit.git');
      }
      throw new Error(`Unexpected command: ${command}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateGitBranchName', () => {
    it('throws when branch name is empty or only whitespace', () => {
      expect(() => validateGitBranchName('')).toThrow('Branch name cannot be empty');
      expect(() => validateGitBranchName('   ')).toThrow('Branch name cannot be empty');
      expect(() => validateGitBranchName('\t\n')).toThrow('Branch name cannot be empty');
    });

    it('throws when branch name contains ".."', () => {
      expect(() => validateGitBranchName('feature..branch')).toThrow(
        "Branch name must not contain '..'"
      );
      expect(() => validateGitBranchName('..')).toThrow(
        "Branch name must not contain '..'"
      );
    });

    it('throws when branch name contains invalid characters', () => {
      expect(() => validateGitBranchName('feature branch')).toThrow(
        'Branch name may only contain letters, numbers, slashes, underscores, periods, and hyphens'
      );
      expect(() => validateGitBranchName('feature@main')).toThrow(
        'Branch name may only contain letters, numbers, slashes, underscores, periods, and hyphens'
      );
    });
  });

  describe('isSameGitRepo', () => {
    it('matches same Bitbucket repo despite auth prefix and .git suffix differences', () => {
      const [sameRepo] = isSameGitRepo(
        'https://bitbucket.org/practice-sf-101/bitbit',
        '/tmp/repo'
      );
      expect(sameRepo).toBe(true);
    });

    it('accepts Bitbucket display-name owner when host and repo match', () => {
      const [sameRepo] = isSameGitRepo(
        'https://bitbucket.org/Aditi%20Shreya/bitbit',
        '/tmp/repo'
      );
      expect(sameRepo).toBe(true);
    });

    it('does not match when repository name differs', () => {
      const [sameRepo] = isSameGitRepo(
        'https://bitbucket.org/practice-sf-101/another-repo',
        '/tmp/repo'
      );
      expect(sameRepo).toBe(false);
    });
  });
});
