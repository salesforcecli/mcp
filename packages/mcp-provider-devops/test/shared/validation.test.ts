import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WorkItem } from '../../src/types/WorkItem.js';
import * as gitUtils from '../../src/shared/gitUtils.js';
import {
  validateLocalGitState,
  validateWorkItemPresence,
  validateWorkItemFields,
  validateLocalRepoMatchesWorkItemRepo
} from '../../src/shared/validation.js';

describe('shared/validation', () => {
  const cleanPath = '/repo/ok';
  const dirtyPath = '/repo/dirty';
  const nonRepoPath = '/not/repo';

  beforeEach(() => {
    vi.spyOn(gitUtils, 'isGitRepository').mockImplementation((p: string) => p !== nonRepoPath);
    vi.spyOn(gitUtils, 'hasUncommittedChanges').mockImplementation((p: string) => p === dirtyPath);
    vi.spyOn(gitUtils, 'isSameGitRepo').mockImplementation((url: string, p: string) => {
      if (p === cleanPath && url === 'https://github.com/acme/app') return [true, 'https://github.com/acme/app'];
      return [false, 'https://github.com/other/other'];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('validateLocalGitState returns null for good repo state', () => {
    const res = validateLocalGitState(cleanPath);
    expect(res).toBeNull();
  });

  it('validateLocalGitState errors when not a git repo', () => {
    const res = validateLocalGitState(nonRepoPath);
    expect(res).not.toBeNull();
    expect(res!.content[0].text).toMatch('not a Git repository');
  });

  it('validateLocalGitState errors when uncommitted changes present', () => {
    const res = validateLocalGitState(dirtyPath);
    expect(res).not.toBeNull();
    expect(res!.content[0].text).toMatch('Local changes detected');
  });

  it('validateWorkItemPresence errors when missing', () => {
    const res = validateWorkItemPresence(undefined as unknown as WorkItem);
    expect(res).not.toBeNull();
    expect(res!.content[0].text).toMatch('Please provide a workItem');
  });

  it('validateWorkItemFields errors when missing fields', () => {
    const wi = { name: 'WI-1' } as unknown as WorkItem;
    const res = validateWorkItemFields(wi);
    expect(res).not.toBeNull();
    expect(res!.content[0].text).toMatch('missing required properties');
  });

  it('validateWorkItemFields passes when fields present', () => {
    const wi: WorkItem = {
      id: '1',
      name: 'WI-1',
      status: 'Open',
      owner: 'me',
      SourceCodeRepository: { repoUrl: 'https://github.com/acme/app', repoType: 'github' },
      WorkItemBranch: 'WI-1',
      TargetBranch: 'main',
      DevopsProjectId: 'p',
      PipelineId: 'pl'
    } as unknown as WorkItem;
    const res = validateWorkItemFields(wi);
    expect(res).toBeNull();
  });

  it('validateLocalRepoMatchesWorkItemRepo passes for same repo', () => {
    const wi: WorkItem = {
      id: '1',
      name: 'WI-1',
      status: 'Open',
      owner: 'me',
      SourceCodeRepository: { repoUrl: 'https://github.com/acme/app', repoType: 'github' },
      WorkItemBranch: 'WI-1',
      TargetBranch: 'main',
      DevopsProjectId: 'p',
      PipelineId: 'pl'
    } as unknown as WorkItem;
    const res = validateLocalRepoMatchesWorkItemRepo(wi, cleanPath);
    expect(res).toBeNull();
  });

  it('validateLocalRepoMatchesWorkItemRepo errors for different repo', () => {
    const wi: WorkItem = {
      id: '1',
      name: 'WI-1',
      status: 'Open',
      owner: 'me',
      SourceCodeRepository: { repoUrl: 'https://github.com/acme/app', repoType: 'github' },
      WorkItemBranch: 'WI-1',
      TargetBranch: 'main',
      DevopsProjectId: 'p',
      PipelineId: 'pl'
    } as unknown as WorkItem;
    const res = validateLocalRepoMatchesWorkItemRepo(wi, '/other');
    expect(res).not.toBeNull();
    expect(res!.content[0].text).toMatch('not of same git repo');
  });
});


