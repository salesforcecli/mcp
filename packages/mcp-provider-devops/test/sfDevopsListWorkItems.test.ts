import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SfDevopsListWorkItems } from '../src/tools/sfDevopsListWorkItems.js';
import { SpyTelemetryService } from './test-doubles.js';
import { TelemetryEventNames } from '../src/constants.js';
import { Services } from '@salesforce/mcp-provider-api';
import * as getWorkItems from '../src/getWorkItems.js';

describe('SfDevopsListWorkItems', () => {
  let tool: SfDevopsListWorkItems;
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
    
    tool = new SfDevopsListWorkItems(mockServices);
  });

  it('should send telemetry on successful work items fetch with usernameOrAlias', async () => {
    const mockWorkItems = [
      { Id: '1', Name: 'WI-001', Status: 'Open' },
      { Id: '2', Name: 'WI-002', Status: 'In Progress' },
    ];

    vi.spyOn(getWorkItems, 'fetchWorkItems').mockResolvedValue(mockWorkItems);

    const result = await tool.exec({ 
      usernameOrAlias: 'test@example.com',
      project: { Id: 'proj-123', Name: 'Test Project' }
    });

    // Verify the result
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('WI-001');

    // Verify telemetry was sent
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.LIST_WORK_ITEMS);
    expect(telemetryEvent.event.success).toBe(true);
    expect(telemetryEvent.event.workItemCount).toBe(2);
    expect(telemetryEvent.event.projectId).toBe('proj-123');
    expect(telemetryEvent.event.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should send telemetry on error', async () => {
    const mockError = new Error('Failed to fetch work items');

    vi.spyOn(getWorkItems, 'fetchWorkItems').mockRejectedValue(mockError);

    const result = await tool.exec({ 
      usernameOrAlias: 'test@example.com',
      project: { Id: 'proj-123' }
    });

    // Verify the result shows error
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Failed to fetch work items');

    // Verify telemetry was sent with error info
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.LIST_WORK_ITEMS);
    expect(telemetryEvent.event.success).toBe(false);
    expect(telemetryEvent.event.error).toBe('Failed to fetch work items');
    expect(telemetryEvent.event.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should work with alias as usernameOrAlias', async () => {
    const mockWorkItems = [
      { Id: '1', Name: 'WI-001', Status: 'Open' },
    ];

    vi.spyOn(getWorkItems, 'fetchWorkItems').mockResolvedValue(mockWorkItems);

    const result = await tool.exec({ 
      usernameOrAlias: 'myDevOpsOrg',
      project: { Id: 'proj-123' }
    });

    // Verify the result
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('WI-001');

    // Verify telemetry was sent
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.LIST_WORK_ITEMS);
    expect(telemetryEvent.event.success).toBe(true);
    expect(telemetryEvent.event.workItemCount).toBe(1);
  });
});

