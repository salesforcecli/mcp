import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectConflict } from '../src/detectConflict.js';
import type { WorkItem } from '../src/types/WorkItem.js';
import * as gitUtils from '../src/shared/gitUtils.js';

describe('detectConflict', () => {
  beforeEach(() => {
    vi.spyOn(gitUtils, 'isGitRepository').mockReturnValue(true);
    vi.spyOn(gitUtils, 'hasUncommittedChanges').mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return an error if no workItem is provided', async () => {
    const result = await detectConflict({});
    expect(result.content[0].text).toContain('Error: Please provide a workItem to check for conflicts.');
  });

  it('should return an error if workItem is missing required properties', async () => {
    const workItem = {
      id: 'WI-0001',
      name: 'Test Work Item',
      // Missing WorkItemBranch, TargetBranch, and SourceCodeRepository
    } as unknown as WorkItem;
    const result = await detectConflict({ workItem });
    expect(result.content[0].text).toContain('Error: Work item is missing required properties');
  });

  it('should request correct path when localPath is not a git repo', async () => {
    vi.mocked(gitUtils.isGitRepository).mockReturnValue(false);
    const workItem: WorkItem = {
      id: 'WI-0002',
      name: 'Repo Check',
      WorkItemBranch: 'feature/abc',
      TargetBranch: 'main',
      SourceCodeRepository: { repoUrl: 'https://example.com/repo.git' }
    } as unknown as WorkItem;
    const result = await detectConflict({ workItem, localPath: '/fake/not-repo' });
    expect(result.content[0].text).toContain('is not a Git repository');
  });

  it('should block when uncommitted changes exist in localPath', async () => {
    vi.mocked(gitUtils.hasUncommittedChanges).mockReturnValue(true);
    const workItem: WorkItem = {
      id: 'WI-0003',
      name: 'Dirty Repo Check',
      WorkItemBranch: 'feature/xyz',
      TargetBranch: 'main',
      SourceCodeRepository: { repoUrl: 'https://example.com/repo.git' }
    } as unknown as WorkItem;

    const result = await detectConflict({ workItem, localPath: '/fake/repo' });
    expect(result.content[0].text).toContain('Local changes detected');
  });
});
