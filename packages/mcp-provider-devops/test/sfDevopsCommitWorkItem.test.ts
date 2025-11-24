import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SfDevopsCommitWorkItem } from '../src/tools/sfDevopsCommitWorkItem.js';
import { SpyTelemetryService } from './test-doubles.js';
import { TelemetryEventNames } from '../src/constants.js';
import { Services } from '@salesforce/mcp-provider-api';
import * as getWorkItems from '../src/getWorkItems.js';
import * as commitWorkItem from '../src/commitLiteWorkItem.js';
import * as pathUtils from '../src/shared/pathUtils.js';

describe('SfDevopsCommitWorkItem', () => {
  let tool: SfDevopsCommitWorkItem;
  let spyTelemetryService: SpyTelemetryService;
  let mockServices: Services;

  beforeEach(() => {
    spyTelemetryService = new SpyTelemetryService();
    
    mockServices = {
      getTelemetryService: () => spyTelemetryService,
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
    
    tool = new SfDevopsCommitWorkItem(mockServices);
  });

  it('should send telemetry on successful commit with usernameOrAlias', async () => {
    const mockWorkItem = {
      Id: '1',
      Name: 'WI-001',
      WorkItemBranch: 'feature/wi-001',
      SourceCodeRepository: { repoUrl: 'https://github.com/test/repo.git' }
    };

    vi.spyOn(pathUtils, 'normalizeAndValidateRepoPath').mockReturnValue('/tmp/repo');
    vi.spyOn(getWorkItems, 'fetchWorkItemByName').mockResolvedValue(mockWorkItem);
    vi.spyOn(commitWorkItem, 'commitWorkItem').mockResolvedValue({
      commitSha: 'abc123',
      requestId: 'req-456'
    });

    const result = await tool.exec({ 
      usernameOrAlias: 'test@example.com',
      workItemName: 'WI-001',
      commitMessage: 'Test commit',
      repoPath: '/tmp/repo'
    });

    // Verify the result
    expect(result.isError).toBeUndefined();
    expect(result.content).toBeDefined();

    // Verify telemetry was sent
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.COMMIT_WORK_ITEM);
    expect(telemetryEvent.event.success).toBe(true);
    expect(telemetryEvent.event.workItemName).toBe('WI-001');
    expect(telemetryEvent.event.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should send telemetry on error', async () => {
    const mockError = new Error('Commit failed');

    vi.spyOn(pathUtils, 'normalizeAndValidateRepoPath').mockReturnValue('/tmp/repo');
    vi.spyOn(getWorkItems, 'fetchWorkItemByName').mockResolvedValue({
      Id: '1',
      Name: 'WI-001',
      WorkItemBranch: 'feature/wi-001',
      SourceCodeRepository: { repoUrl: 'https://github.com/test/repo.git' }
    });
    vi.spyOn(commitWorkItem, 'commitWorkItem').mockRejectedValue(mockError);

    const result = await tool.exec({ 
      usernameOrAlias: 'test@example.com',
      workItemName: 'WI-001',
      commitMessage: 'Test commit',
      repoPath: '/tmp/repo'
    });

    // Verify the result shows error
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Commit failed');

    // Verify telemetry was sent with error info
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.COMMIT_WORK_ITEM);
    expect(telemetryEvent.event.success).toBe(false);
    expect(telemetryEvent.event.error).toBe('Commit failed');
    expect(telemetryEvent.event.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should work with alias as usernameOrAlias', async () => {
    const mockWorkItem = {
      Id: '1',
      Name: 'WI-001',
      WorkItemBranch: 'feature/wi-001',
      SourceCodeRepository: { repoUrl: 'https://github.com/test/repo.git' }
    };

    vi.spyOn(pathUtils, 'normalizeAndValidateRepoPath').mockReturnValue('/tmp/repo');
    vi.spyOn(getWorkItems, 'fetchWorkItemByName').mockResolvedValue(mockWorkItem);
    vi.spyOn(commitWorkItem, 'commitWorkItem').mockResolvedValue({
      commitSha: 'abc123',
      requestId: 'req-456'
    });

    const result = await tool.exec({ 
      usernameOrAlias: 'myDevOpsOrg',
      workItemName: 'WI-001',
      commitMessage: 'Test commit',
      repoPath: '/tmp/repo'
    });

    // Verify the result
    expect(result.isError).toBeUndefined();

    // Verify telemetry was sent
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.COMMIT_WORK_ITEM);
    expect(telemetryEvent.event.success).toBe(true);
    expect(telemetryEvent.event.workItemName).toBe('WI-001');
  });
});

