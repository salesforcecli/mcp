import { describe, it, expect } from 'vitest';
import { validateGitBranchName } from '../../src/shared/gitUtils.js';

describe('shared/gitUtils', () => {
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
});
