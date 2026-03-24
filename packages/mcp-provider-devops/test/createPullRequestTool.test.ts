import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Services } from '@salesforce/mcp-provider-api';
import { CreatePullRequest } from '../src/tools/createPullRequest.js';
import * as getWorkItemsModule from '../src/getWorkItems.js';
import * as createPullRequestModule from '../src/createPullRequest.js';

describe('CreatePullRequest tool', () => {
  let tool: CreatePullRequest;
  let getConnectionMock: ReturnType<typeof vi.fn>;
  let mockServices: Services;

  beforeEach(() => {
    getConnectionMock = vi.fn().mockResolvedValue({});

    mockServices = {
      getOrgService: () => ({
        getConnection: getConnectionMock,
        getAllowedOrgUsernames: vi.fn(),
        getAllowedOrgs: vi.fn(),
        getDefaultTargetOrg: vi.fn(),
        getDefaultTargetDevHub: vi.fn(),
        findOrgByUsernameOrAlias: vi.fn(),
      }),
      getTelemetryService: () => ({
        sendEvent: vi.fn(),
        addContextAttribute: vi.fn(),
      }),
      getConfigService: () => ({
        getDataDir: vi.fn(),
        getStartupFlags: vi.fn(),
      }),
    } as unknown as Services;

    tool = new CreatePullRequest(mockServices);
  });

  it('returns isError=true when usernameOrAlias is missing', async () => {
    const result = await tool.exec({
      workItemName: 'WI-0001',
      usernameOrAlias: '',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Username or alias is required');
  });

  it('returns isError=true when work item cannot be found', async () => {
    vi.spyOn(getWorkItemsModule, 'fetchWorkItemByName').mockResolvedValue(undefined);

    const result = await tool.exec({
      workItemName: 'WI-0001',
      usernameOrAlias: 'test@example.com',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Work item Name is required');
  });

  it('returns isError=false on successful pull request creation', async () => {
    vi.spyOn(getWorkItemsModule, 'fetchWorkItemByName').mockResolvedValue({ id: '1fkxx0000000001AAA' });
    const pullRequestResult = { status: 'Success', id: 'PR-1', reviewUrl: 'https://example.test/pr/1' };
    vi.spyOn(createPullRequestModule, 'createPullRequest').mockResolvedValue({
      success: true,
      pullRequestResult,
    } as any);

    const result = await tool.exec({
      workItemName: 'WI-0001',
      usernameOrAlias: 'test@example.com',
    });

    expect(result.isError).toBe(false);
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.workItemId).toBe('1fkxx0000000001AAA');
    expect(payload.usernameOrAlias).toBe('test@example.com');
    expect(payload.message).toContain('created successfully');
    expect(payload.pullRequestData).toEqual(pullRequestResult);
  });

  it('uses the success fallback message when PR payload has no message', async () => {
    vi.spyOn(getWorkItemsModule, 'fetchWorkItemByName').mockResolvedValue({ id: '1fkxx0000000002AAA' });
    vi.spyOn(createPullRequestModule, 'createPullRequest').mockResolvedValue({
      success: true,
      pullRequestResult: { status: 'Success', id: 'PR-2' },
    } as any);

    const result = await tool.exec({
      workItemName: 'WI-0002',
      usernameOrAlias: 'alias-org',
    });

    expect(result.isError).toBe(false);
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.message).toBe('Pull request created successfully for work item: 1fkxx0000000002AAA');
  });

  it('returns isError=true when pull request API reports error', async () => {
    vi.spyOn(getWorkItemsModule, 'fetchWorkItemByName').mockResolvedValue({ id: '1fkxx0000000001AAA' });
    vi.spyOn(createPullRequestModule, 'createPullRequest').mockResolvedValue({
      success: false,
      pullRequestResult: { status: 'Error', errorMessage: 'PR failed' },
    } as any);

    const result = await tool.exec({
      workItemName: 'WI-0001',
      usernameOrAlias: 'test@example.com',
    });

    expect(result.isError).toBe(true);
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.message).toContain('PR failed');
  });

  it('stringifies non-string error messages from PR payload', async () => {
    vi.spyOn(getWorkItemsModule, 'fetchWorkItemByName').mockResolvedValue({ id: '1fkxx0000000003AAA' });
    vi.spyOn(createPullRequestModule, 'createPullRequest').mockResolvedValue({
      success: false,
      pullRequestResult: { status: 'Error', message: { details: 'Bad request', code: 'PR_400' } },
    } as any);

    const result = await tool.exec({
      workItemName: 'WI-0003',
      usernameOrAlias: 'test@example.com',
    });

    expect(result.isError).toBe(true);
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.message).toBe(JSON.stringify({ details: 'Bad request', code: 'PR_400' }));
  });
});
