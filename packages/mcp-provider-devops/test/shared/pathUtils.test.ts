import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import * as gitUtils from '../../src/shared/gitUtils.js';
import { isSalesforceOrDevOpsProject } from '../../src/shared/pathUtils.js';

describe('shared/pathUtils', () => {
  const repoPath = '/repo';

  beforeEach(() => {
    vi.spyOn(gitUtils, 'isGitRepository');
    vi.spyOn(fs, 'existsSync');
    vi.spyOn(fs, 'statSync');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isSalesforceOrDevOpsProject', () => {
    it('returns false when path is not a git repository', () => {
      vi.mocked(gitUtils.isGitRepository).mockReturnValue(false);
      expect(isSalesforceOrDevOpsProject(repoPath)).toBe(false);
      expect(gitUtils.isGitRepository).toHaveBeenCalledWith(repoPath);
    });

    it('returns true when sfdx-project.json exists', () => {
      vi.mocked(gitUtils.isGitRepository).mockReturnValue(true);
      vi.mocked(fs.existsSync).mockImplementation((p: string) => p === path.join(repoPath, 'sfdx-project.json'));
      expect(isSalesforceOrDevOpsProject(repoPath)).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledWith(path.join(repoPath, 'sfdx-project.json'));
    });

    it('returns true when force-app exists and is a directory', () => {
      const forceAppPath = path.join(repoPath, 'force-app');
      vi.mocked(gitUtils.isGitRepository).mockReturnValue(true);
      vi.mocked(fs.existsSync).mockImplementation((p: string) => {
        if (p === path.join(repoPath, 'sfdx-project.json')) return false;
        if (p === forceAppPath) return true;
        return false;
      });
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
      expect(isSalesforceOrDevOpsProject(repoPath)).toBe(true);
    });

    it('returns true when main exists and is a directory', () => {
      const forceAppPath = path.join(repoPath, 'force-app');
      const mainPath = path.join(repoPath, 'main');
      vi.mocked(gitUtils.isGitRepository).mockReturnValue(true);
      vi.mocked(fs.existsSync).mockImplementation((p: string) => {
        if (p === path.join(repoPath, 'sfdx-project.json')) return false;
        if (p === forceAppPath) return false;
        if (p === mainPath) return true;
        return false;
      });
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
      expect(isSalesforceOrDevOpsProject(repoPath)).toBe(true);
    });

    it('returns false when git repo but no Salesforce layout', () => {
      vi.mocked(gitUtils.isGitRepository).mockReturnValue(true);
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(isSalesforceOrDevOpsProject(repoPath)).toBe(false);
    });
  });
});
