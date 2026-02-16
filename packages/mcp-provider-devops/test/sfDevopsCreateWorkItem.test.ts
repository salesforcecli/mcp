import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SfDevopsCreateWorkItem } from '../src/tools/sfDevopsCreateWorkItem.js';
import { SpyTelemetryService } from './test-doubles.js';
import { TelemetryEventNames } from '../src/constants.js';
import { Services } from '@salesforce/mcp-provider-api';
import * as createWorkItemModule from '../src/createWorkItem.js';

describe('SfDevopsCreateWorkItem', () => {
  let tool: SfDevopsCreateWorkItem;
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

    tool = new SfDevopsCreateWorkItem(mockServices);
  });

  it('should send telemetry on successful create with usernameOrAlias', async () => {
    vi.spyOn(createWorkItemModule, 'createWorkItem').mockResolvedValue({
      success: true,
      workItemId: '1QgSB0000004pwn0AA',
      workItemName: 'WI-00000001',
      subject: 'New work item',
    });

    const result = await tool.exec({
      usernameOrAlias: 'test@example.com',
      projectId: '1QgSB0000004pwn0AA',
      subject: 'New work item',
      description: 'Work item description',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('WI-00000001');
    expect(result.content[0].text).toContain('New work item');

    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.CREATE_WORK_ITEM);
    expect(telemetryEvent.event.success).toBe(true);
    expect(telemetryEvent.event.projectId).toBe('1QgSB0000004pwn0AA');
    expect(telemetryEvent.event.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should send telemetry and return error when create returns success: false', async () => {
    vi.spyOn(createWorkItemModule, 'createWorkItem').mockResolvedValue({
      success: false,
      error: 'Project not found',
    });

    const result = await tool.exec({
      usernameOrAlias: 'test@example.com',
      projectId: 'bad-project-id',
      subject: 'New work item',
      description: 'Description',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Project not found');

    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.CREATE_WORK_ITEM);
    expect(telemetryEvent.event.success).toBe(false);
    expect(telemetryEvent.event.error).toBe('Project not found');
    expect(telemetryEvent.event.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should send telemetry on thrown error', async () => {
    const mockError = new Error('Network failed');
    vi.spyOn(createWorkItemModule, 'createWorkItem').mockRejectedValue(mockError);

    const result = await tool.exec({
      usernameOrAlias: 'test@example.com',
      projectId: '1QgSB0000004pwn0AA',
      subject: 'New work item',
      description: 'Description',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Network failed');

    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.CREATE_WORK_ITEM);
    expect(telemetryEvent.event.success).toBe(false);
    expect(telemetryEvent.event.error).toBe('Network failed');
    expect(telemetryEvent.event.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should work with alias as usernameOrAlias', async () => {
    vi.spyOn(createWorkItemModule, 'createWorkItem').mockResolvedValue({
      success: true,
      workItemId: '1',
      workItemName: 'WI-00000002',
      subject: 'Unit tests',
    });

    const result = await tool.exec({
      usernameOrAlias: 'myDevOpsOrg',
      projectId: '1QgSB0000004pwn0AA',
      subject: 'Unit tests',
      description: '',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('WI-00000002');

    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.CREATE_WORK_ITEM);
    expect(telemetryEvent.event.success).toBe(true);
  });

  it('should call createWorkItem with correct arguments', async () => {
    const createSpy = vi.spyOn(createWorkItemModule, 'createWorkItem').mockResolvedValue({
      success: true,
      workItemId: '1',
      workItemName: 'WI-001',
      subject: 'Subject',
    });

    await tool.exec({
      usernameOrAlias: 'org@example.com',
      projectId: 'proj-123',
      subject: 'Subject',
      description: 'Description',
    });

    expect(createSpy).toHaveBeenCalledWith({
      usernameOrAlias: 'org@example.com',
      projectId: 'proj-123',
      subject: 'Subject',
      description: 'Description',
    });
  });
});
