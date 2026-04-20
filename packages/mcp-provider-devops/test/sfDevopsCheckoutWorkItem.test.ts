import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SfDevopsCheckoutWorkItem } from '../src/tools/sfDevopsCheckoutWorkItem.js';
import { SpyTelemetryService } from './test-doubles.js';
import { TelemetryEventNames } from '../src/constants.js';
import { Services } from '@salesforce/mcp-provider-api';
import * as getWorkItems from '../src/getWorkItems.js';
import * as checkoutBranch from '../src/checkoutWorkitemBranch.js';
import * as pathUtils from '../src/shared/pathUtils.js';
import { SfDevopsUpdateWorkItemStatus } from '../src/tools/sfDevopsUpdateWorkItemStatus.js';

describe('SfDevopsCheckoutWorkItem', () => {
  let tool: SfDevopsCheckoutWorkItem;
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
    
    tool = new SfDevopsCheckoutWorkItem(mockServices);
  });

  it('should send telemetry on successful checkout with usernameOrAlias', async () => {
    const mockWorkItem = {
      Id: '1',
      Name: 'WI-001',
      subject: 'Fix login',
      description: 'Resolve login redirect bug',
      status: 'New',
      WorkItemBranch: 'feature/wi-001',
      SourceCodeRepository: { repoUrl: 'https://github.com/test/repo.git' }
    };

    vi.spyOn(getWorkItems, 'fetchWorkItemByName').mockResolvedValue(mockWorkItem);
    vi.spyOn(pathUtils, 'normalizeAndValidateRepoPath').mockReturnValue('/tmp/repo');
    const updateStatusSpy = vi.spyOn(SfDevopsUpdateWorkItemStatus.prototype, 'exec').mockResolvedValue({
      content: [{ type: 'text', text: '{"success": true}' }]
    });
    vi.spyOn(checkoutBranch, 'checkoutWorkitemBranch').mockResolvedValue({
      content: [{ type: 'text', text: 'Checkout successful' }]
    });

    const result = await tool.exec({ 
      usernameOrAlias: 'test@example.com',
      workItemName: 'WI-001',
      localPath: '/tmp/repo'
    });

    // Verify the result
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Checkout successful');
    expect(result.content[1].text).toContain('Fix login');
    expect(result.content[1].text).toContain('Resolve login redirect bug');
    expect(updateStatusSpy).toHaveBeenCalledTimes(1);
    expect(updateStatusSpy).toHaveBeenCalledWith({
      usernameOrAlias: 'test@example.com',
      workItemName: 'WI-001',
      status: 'In Progress'
    });

    // Verify telemetry was sent
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.CHECKOUT_WORK_ITEM);
    expect(telemetryEvent.event.success).toBe(true);
    expect(telemetryEvent.event.workItemName).toBe('WI-001');
    expect(telemetryEvent.event.branchName).toBe('feature/wi-001');
    expect(telemetryEvent.event.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should send telemetry on fetch error', async () => {
    const mockError = new Error('Work item not found');

    vi.spyOn(pathUtils, 'normalizeAndValidateRepoPath').mockReturnValue('/tmp/repo');
    vi.spyOn(getWorkItems, 'fetchWorkItemByName').mockRejectedValue(mockError);

    const result = await tool.exec({ 
      usernameOrAlias: 'test@example.com',
      workItemName: 'WI-001',
      localPath: '/tmp/repo'
    });

    // Verify the result shows error
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Work item not found');

    // Verify telemetry was sent with error info
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.CHECKOUT_WORK_ITEM);
    expect(telemetryEvent.event.success).toBe(false);
    expect(telemetryEvent.event.error).toContain('Work item not found');
    expect(telemetryEvent.event.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should send telemetry on checkout error', async () => {
    const mockWorkItem = {
      Id: '1',
      Name: 'WI-001',
      status: 'Open',
      WorkItemBranch: 'feature/wi-001',
      SourceCodeRepository: { repoUrl: 'https://github.com/test/repo.git' }
    };
    const mockError = new Error('Git checkout failed');

    vi.spyOn(pathUtils, 'normalizeAndValidateRepoPath').mockReturnValue('/tmp/repo');
    vi.spyOn(getWorkItems, 'fetchWorkItemByName').mockResolvedValue(mockWorkItem);
    const updateStatusSpy = vi.spyOn(SfDevopsUpdateWorkItemStatus.prototype, 'exec').mockResolvedValue({
      content: [{ type: 'text', text: '{"success": true}' }]
    });
    vi.spyOn(checkoutBranch, 'checkoutWorkitemBranch').mockRejectedValue(mockError);

    const result = await tool.exec({ 
      usernameOrAlias: 'test@example.com',
      workItemName: 'WI-001',
      localPath: '/tmp/repo'
    });

    // Verify the result shows error
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Git checkout failed');
    expect(updateStatusSpy).not.toHaveBeenCalled();

    // Verify telemetry was sent with error info
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.CHECKOUT_WORK_ITEM);
    expect(telemetryEvent.event.success).toBe(false);
    expect(telemetryEvent.event.error).toContain('Git checkout failed');
    expect(telemetryEvent.event.workItemName).toBe('WI-001');
  });

  it('should work with alias as usernameOrAlias', async () => {
    const mockWorkItem = {
      Id: '1',
      Name: 'WI-001',
      status: 'New',
      WorkItemBranch: 'feature/wi-001',
      SourceCodeRepository: { repoUrl: 'https://github.com/test/repo.git' }
    };

    vi.spyOn(pathUtils, 'normalizeAndValidateRepoPath').mockReturnValue('/tmp/repo');
    vi.spyOn(getWorkItems, 'fetchWorkItemByName').mockResolvedValue(mockWorkItem);
    vi.spyOn(SfDevopsUpdateWorkItemStatus.prototype, 'exec').mockResolvedValue({
      content: [{ type: 'text', text: '{"success": true}' }]
    });
    vi.spyOn(checkoutBranch, 'checkoutWorkitemBranch').mockResolvedValue({
      content: [{ type: 'text', text: 'Checkout successful' }]
    });

    const result = await tool.exec({ 
      usernameOrAlias: 'myDevOpsOrg',
      workItemName: 'WI-001',
      localPath: '/tmp/repo'
    });

    // Verify the result
    expect(result.isError).toBeUndefined();

    // Verify telemetry was sent
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.CHECKOUT_WORK_ITEM);
    expect(telemetryEvent.event.success).toBe(true);
  });

  it('should skip status update when work item is already In Progress', async () => {
    const mockWorkItem = {
      Id: '1',
      Name: 'WI-001',
      status: 'In Progress',
      WorkItemBranch: 'feature/wi-001',
      SourceCodeRepository: { repoUrl: 'https://github.com/test/repo.git' }
    };

    vi.spyOn(pathUtils, 'normalizeAndValidateRepoPath').mockReturnValue('/tmp/repo');
    vi.spyOn(getWorkItems, 'fetchWorkItemByName').mockResolvedValue(mockWorkItem);
    const updateStatusSpy = vi.spyOn(SfDevopsUpdateWorkItemStatus.prototype, 'exec').mockResolvedValue({
      content: [{ type: 'text', text: '{"success": true}' }]
    });
    vi.spyOn(checkoutBranch, 'checkoutWorkitemBranch').mockResolvedValue({
      content: [{ type: 'text', text: 'Checkout successful' }]
    });

    const result = await tool.exec({
      usernameOrAlias: 'test@example.com',
      workItemName: 'WI-001',
      localPath: '/tmp/repo'
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Checkout successful');
    expect(updateStatusSpy).not.toHaveBeenCalled();
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    expect(spyTelemetryService.sendEventCallHistory[0].event.success).toBe(true);
  });

  it('should skip status update when work item status is not New', async () => {
    const mockWorkItem = {
      Id: '1',
      Name: 'WI-001',
      status: 'Ready to Promote',
      WorkItemBranch: 'feature/wi-001',
      SourceCodeRepository: { repoUrl: 'https://github.com/test/repo.git' }
    };

    vi.spyOn(pathUtils, 'normalizeAndValidateRepoPath').mockReturnValue('/tmp/repo');
    vi.spyOn(getWorkItems, 'fetchWorkItemByName').mockResolvedValue(mockWorkItem);
    const updateStatusSpy = vi.spyOn(SfDevopsUpdateWorkItemStatus.prototype, 'exec').mockResolvedValue({
      content: [{ type: 'text', text: '{"success": true}' }]
    });
    vi.spyOn(checkoutBranch, 'checkoutWorkitemBranch').mockResolvedValue({
      content: [{ type: 'text', text: 'Checkout successful' }]
    });

    const result = await tool.exec({
      usernameOrAlias: 'test@example.com',
      workItemName: 'WI-001',
      localPath: '/tmp/repo'
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Checkout successful');
    expect(updateStatusSpy).not.toHaveBeenCalled();
  });

  it('should retry checkout after marking New work item In Progress', async () => {
    const initialWorkItem = {
      Id: '1',
      Name: 'WI-001',
      status: 'New',
      WorkItemBranch: 'feature/wi-001',
      SourceCodeRepository: { repoUrl: 'https://github.com/test/repo.git' }
    };

    vi.spyOn(pathUtils, 'normalizeAndValidateRepoPath').mockReturnValue('/tmp/repo');
    vi.spyOn(getWorkItems, 'fetchWorkItemByName').mockResolvedValue(initialWorkItem);
    const updateStatusSpy = vi.spyOn(SfDevopsUpdateWorkItemStatus.prototype, 'exec').mockResolvedValue({
      content: [{ type: 'text', text: '{"success": true}' }]
    });
    const checkoutSpy = vi.spyOn(checkoutBranch, 'checkoutWorkitemBranch')
      .mockRejectedValueOnce(new Error('remote branch not found'))
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Checkout successful after retry' }] });

    const result = await tool.exec({
      usernameOrAlias: 'test@example.com',
      workItemName: 'WI-001',
      localPath: '/tmp/repo'
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Checkout successful after retry');
    expect(updateStatusSpy).toHaveBeenCalledTimes(1);
    expect(checkoutSpy).toHaveBeenCalledTimes(2);
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    expect(spyTelemetryService.sendEventCallHistory[0].event.success).toBe(true);
  });

  it('should update and refetch when New work item is missing repo or branch info', async () => {
    const initialWorkItem = {
      Id: '1',
      Name: 'WI-001',
      status: 'New',
      WorkItemBranch: undefined,
      SourceCodeRepository: undefined
    };
    const refreshedWorkItem = {
      Id: '1',
      Name: 'WI-001',
      status: 'In Progress',
      WorkItemBranch: 'feature/wi-001',
      SourceCodeRepository: { repoUrl: 'https://github.com/test/repo.git' }
    };

    vi.spyOn(pathUtils, 'normalizeAndValidateRepoPath').mockReturnValue('/tmp/repo');
    const fetchSpy = vi.spyOn(getWorkItems, 'fetchWorkItemByName')
      .mockResolvedValueOnce(initialWorkItem)
      .mockResolvedValueOnce(refreshedWorkItem);
    const updateStatusSpy = vi.spyOn(SfDevopsUpdateWorkItemStatus.prototype, 'exec').mockResolvedValue({
      content: [{ type: 'text', text: '{"success": true}' }]
    });
    const checkoutSpy = vi.spyOn(checkoutBranch, 'checkoutWorkitemBranch').mockResolvedValue({
      content: [{ type: 'text', text: 'Checkout successful' }]
    });

    const result = await tool.exec({
      usernameOrAlias: 'test@example.com',
      workItemName: 'WI-001',
      localPath: '/tmp/repo'
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Checkout successful');
    expect(updateStatusSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(checkoutSpy).toHaveBeenCalledTimes(1);
  });
});

