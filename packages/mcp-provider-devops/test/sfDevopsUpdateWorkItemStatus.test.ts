import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SfDevopsUpdateWorkItemStatus } from '../src/tools/sfDevopsUpdateWorkItemStatus.js';
import { SpyTelemetryService } from './test-doubles.js';
import { TelemetryEventNames } from '../src/constants.js';
import { Services } from '@salesforce/mcp-provider-api';
import * as updateWorkItemStatusModule from '../src/updateWorkItemStatus.js';

describe('SfDevopsUpdateWorkItemStatus', () => {
  let tool: SfDevopsUpdateWorkItemStatus;
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

    tool = new SfDevopsUpdateWorkItemStatus(mockServices);
  });

  it('should send telemetry on successful status update to In Progress', async () => {
    vi.spyOn(updateWorkItemStatusModule, 'updateWorkItemStatus').mockResolvedValue({
      success: true,
      workItemId: '1',
      workItemName: 'WI-00000001',
      status: 'In Progress',
    });

    const result = await tool.exec({
      usernameOrAlias: 'test@example.com',
      workItemName: 'WI-00000001',
      status: 'In Progress',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('WI-00000001');
    expect(result.content[0].text).toContain('In Progress');

    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.UPDATE_WORK_ITEM_STATUS);
    expect(telemetryEvent.event.success).toBe(true);
    expect(telemetryEvent.event.workItemName).toBe('WI-00000001');
    expect(telemetryEvent.event.status).toBe('In Progress');
    expect(telemetryEvent.event.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should send telemetry on successful status update to Ready to Promote', async () => {
    vi.spyOn(updateWorkItemStatusModule, 'updateWorkItemStatus').mockResolvedValue({
      success: true,
      workItemId: '1',
      workItemName: 'WI-00000002',
      status: 'Ready to Promote',
    });

    const result = await tool.exec({
      usernameOrAlias: 'test@example.com',
      workItemName: 'WI-00000002',
      status: 'Ready to Promote',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Ready to Promote');

    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.UPDATE_WORK_ITEM_STATUS);
    expect(telemetryEvent.event.success).toBe(true);
    expect(telemetryEvent.event.status).toBe('Ready to Promote');
  });

  it('should send telemetry and return error when update returns success: false', async () => {
    vi.spyOn(updateWorkItemStatusModule, 'updateWorkItemStatus').mockResolvedValue({
      success: false,
      workItemName: 'WI-00000099',
      status: 'In Progress',
      error: 'Work Item not found: WI-00000099',
    });

    const result = await tool.exec({
      usernameOrAlias: 'test@example.com',
      workItemName: 'WI-00000099',
      status: 'In Progress',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Work Item not found');

    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.UPDATE_WORK_ITEM_STATUS);
    expect(telemetryEvent.event.success).toBe(false);
    expect(telemetryEvent.event.error).toContain('Work Item not found');
    expect(telemetryEvent.event.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should send telemetry on thrown error', async () => {
    const mockError = new Error('API timeout');
    vi.spyOn(updateWorkItemStatusModule, 'updateWorkItemStatus').mockRejectedValue(mockError);

    const result = await tool.exec({
      usernameOrAlias: 'test@example.com',
      workItemName: 'WI-00000001',
      status: 'Ready to Promote',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('API timeout');

    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.UPDATE_WORK_ITEM_STATUS);
    expect(telemetryEvent.event.success).toBe(false);
    expect(telemetryEvent.event.error).toBe('API timeout');
    expect(telemetryEvent.event.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should work with alias as usernameOrAlias', async () => {
    vi.spyOn(updateWorkItemStatusModule, 'updateWorkItemStatus').mockResolvedValue({
      success: true,
      workItemId: '1',
      workItemName: 'WI-00000001',
      status: 'In Progress',
    });

    const result = await tool.exec({
      usernameOrAlias: 'myDevOpsOrg',
      workItemName: 'WI-00000001',
      status: 'In Progress',
    });

    expect(result.isError).toBeUndefined();

    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.UPDATE_WORK_ITEM_STATUS);
    expect(telemetryEvent.event.success).toBe(true);
    expect(telemetryEvent.event.workItemName).toBe('WI-00000001');
  });

  it('should call updateWorkItemStatus with correct arguments', async () => {
    const updateSpy = vi.spyOn(updateWorkItemStatusModule, 'updateWorkItemStatus').mockResolvedValue({
      success: true,
      workItemId: '1',
      workItemName: 'WI-00000001',
      status: 'Ready to Promote',
    });

    await tool.exec({
      usernameOrAlias: 'org@example.com',
      workItemName: 'WI-00000001',
      status: 'Ready to Promote',
    });

    expect(updateSpy).toHaveBeenCalledWith('org@example.com', 'WI-00000001', 'Ready to Promote');
  });
});
