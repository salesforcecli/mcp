import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SfDevopsResolveDeploymentFailure } from '../src/tools/sfDevopsResolveDeploymentFailure.js';
import { Services } from '@salesforce/mcp-provider-api';
import * as pathUtils from '../src/shared/pathUtils.js';
import * as gitUtils from '../src/shared/gitUtils.js';
import * as resolveDeploymentFailure from '../src/resolveDeploymentFailure.js';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from 'node:child_process';

const mockExecFileSync = vi.mocked(execFileSync);

describe('SfDevopsResolveDeploymentFailure', () => {
  let tool: SfDevopsResolveDeploymentFailure;
  let mockServices: Services;
  const resolvedPath = '/tmp/repo';

  beforeEach(() => {
    mockServices = {
      getTelemetryService: () => ({ sendEvent: vi.fn() }),
      getOrgService: () => ({
        getConnection: vi.fn(),
        getAllowedOrgUsernames: vi.fn(),
        getAllowedOrgs: vi.fn(),
        getDefaultTargetOrg: vi.fn(),
        getDefaultTargetDevHub: vi.fn(),
        findOrgByUsernameOrAlias: vi.fn(),
      }),
      getConfigService: () => ({
        getDataDir: vi.fn(),
        getStartupFlags: vi.fn(),
      }),
    };
    tool = new SfDevopsResolveDeploymentFailure(mockServices);

    vi.spyOn(pathUtils, 'normalizeAndValidateRepoPath').mockReturnValue(resolvedPath);
    vi.spyOn(pathUtils, 'isSalesforceOrDevOpsProject').mockReturnValue(true);
    vi.spyOn(gitUtils, 'validateGitBranchName').mockImplementation((name: string) => name.trim());
    mockExecFileSync.mockReturnValue('');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const defaultInput = {
    usernameOrAlias: 'test@example.com',
    workItemName: 'WI-001',
    sourceBranchName: 'feature/wi-001',
    errorDetails: 'no ApexClass named TestFive found',
  };

  it('returns error when sourceBranchName is invalid', async () => {
    vi.mocked(gitUtils.validateGitBranchName).mockImplementation(() => {
      throw new Error('Branch name cannot be empty');
    });
    const result = await tool.exec({
      ...defaultInput,
      sourceBranchName: '  ',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid sourceBranchName');
    expect(result.content[0].text).toContain('Branch name cannot be empty');
  });

  it('returns error when targetBranchName is provided and invalid', async () => {
    vi.mocked(gitUtils.validateGitBranchName)
      .mockReturnValueOnce('feature/wi-001')
      .mockImplementationOnce(() => {
        throw new Error("Branch name must not contain '..'");
      });
    const result = await tool.exec({
      ...defaultInput,
      targetBranchName: 'main..bad',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid targetBranchName');
    expect(result.content[0].text).toContain("Branch name must not contain '..'");
  });

  it('returns non-error content when path is not a Salesforce/DevOps project', async () => {
    vi.mocked(pathUtils.isSalesforceOrDevOpsProject).mockReturnValue(false);
    const result = await tool.exec({ ...defaultInput, localPath: '/some/path' });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('not a Salesforce/DevOps project');
    expect(result.content[0].text).toContain(resolvedPath);
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it('returns error when git checkout fails', async () => {
    mockExecFileSync.mockImplementation(() => {
      throw Object.assign(new Error('local changes would be overwritten'), {
        stderr: 'error: Your local changes would be overwritten by checkout.',
      });
    });
    const result = await tool.exec(defaultInput);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Could not checkout source branch');
    expect(result.content[0].text).toContain('feature/wi-001');
    expect(result.content[0].text).toMatch(/Stash|local changes/i);
  });

  it('returns merge conflict message when canFullPromotionFixFailure says merge_conflict', async () => {
    vi.spyOn(resolveDeploymentFailure, 'canFullPromotionFixFailure').mockReturnValue({
      canFix: false,
      reason: 'merge_conflict',
    });
    const result = await tool.exec(defaultInput);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('merge conflict');
    expect(result.content[0].text).toContain('resolve_devops_center_merge_conflict');
    expect(result.content[0].text).toContain(defaultInput.workItemName);
  });

  it('returns generic instructions when full promotion cannot fix (e.g. no_dependency_parsed)', async () => {
    vi.spyOn(resolveDeploymentFailure, 'canFullPromotionFixFailure').mockReturnValue({
      canFix: false,
      reason: 'no_dependency_parsed',
    });
    const result = await tool.exec(defaultInput);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Full promotion **cannot** fix');
    expect(result.content[0].text).toContain('Generic instructions');
    expect(result.content[0].text).toContain('resolve_devops_center_merge_conflict');
  });

  it('returns generic instructions with dependency context when dependency_not_in_source_branch', async () => {
    vi.spyOn(resolveDeploymentFailure, 'canFullPromotionFixFailure').mockReturnValue({
      canFix: false,
      reason: 'dependency_not_in_source_branch',
      missingDependencyName: 'TestFive',
    });
    const result = await tool.exec(defaultInput);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('missing dependency "TestFive"');
    expect(result.content[0].text).toContain('was not found in source branch');
  });

  it('returns confirmation message when full promotion can fix (dependency_in_source_branch)', async () => {
    vi.spyOn(resolveDeploymentFailure, 'canFullPromotionFixFailure').mockReturnValue({
      canFix: true,
      reason: 'dependency_in_source_branch',
      missingDependencyName: 'TestFive',
      inTargetBranch: undefined,
    });
    const result = await tool.exec(defaultInput);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Full promotion can resolve this failure');
    expect(result.content[0].text).toContain('Ask for confirmation');
    expect(result.content[0].text).toContain('promote_devops_center_work_item');
    expect(result.content[0].text).toContain(defaultInput.workItemName);
    expect(result.content[0].text).toContain(defaultInput.usernameOrAlias);
    expect(result.content[0].text).toContain('isFullDeploy: true');
  });

  it('includes comparison note when targetBranchName provided and dependency not in target', async () => {
    vi.spyOn(resolveDeploymentFailure, 'canFullPromotionFixFailure').mockReturnValue({
      canFix: true,
      reason: 'dependency_in_source_branch',
      missingDependencyName: 'TestFive',
      inTargetBranch: false,
    });
    const result = await tool.exec({
      ...defaultInput,
      targetBranchName: 'main',
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('not in target branch');
    expect(result.content[0].text).toContain('main');
  });

  it('includes comparison note when dependency in both source and target', async () => {
    vi.spyOn(resolveDeploymentFailure, 'canFullPromotionFixFailure').mockReturnValue({
      canFix: true,
      reason: 'dependency_in_source_branch',
      missingDependencyName: 'TestFive',
      inTargetBranch: true,
    });
    const result = await tool.exec({
      ...defaultInput,
      targetBranchName: 'main',
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('present in both source and target');
  });
});
