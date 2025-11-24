import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SfDevopsPromoteWorkItem } from '../src/tools/sfDevopsPromoteWorkItem.js';
import { SpyTelemetryService } from './test-doubles.js';
import { TelemetryEventNames } from '../src/constants.js';
import { Services } from '@salesforce/mcp-provider-api';
import * as getWorkItems from '../src/getWorkItems.js';
import * as promoteWorkItems from '../src/promoteWorkItems.js';

describe('SfDevopsPromoteWorkItem', () => {
  let tool: SfDevopsPromoteWorkItem;
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
    
    tool = new SfDevopsPromoteWorkItem(mockServices);
  });

  it('should send telemetry on successful promotion with usernameOrAlias', async () => {
    const mockWorkItems = [
      {
        id: '1',
        name: 'WI-001',
        PipelineStageId: 'stage-1',
        TargetStageId: 'stage-2',
        PipelineId: 'pipeline-1'
      },
    ];

    vi.spyOn(getWorkItems, 'fetchWorkItemsByNames').mockResolvedValue(mockWorkItems);
    vi.spyOn(promoteWorkItems, 'promoteWorkItems').mockResolvedValue({
      requestId: 'req-123',
      status: 'Success'
    });

    const result = await tool.exec({ 
      usernameOrAlias: 'test@example.com',
      workItemNames: ['WI-001']
    });

    // Verify the result
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('req-123');

    // Verify telemetry was sent
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.PROMOTE_WORK_ITEM);
    expect(telemetryEvent.event.success).toBe(true);
    expect(telemetryEvent.event.workItemCount).toBe(1);
    expect(telemetryEvent.event.workItemNames).toContain('WI-001');
    expect(telemetryEvent.event.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should send telemetry on fetch error', async () => {
    const mockError = new Error('Work items not found');

    vi.spyOn(getWorkItems, 'fetchWorkItemsByNames').mockRejectedValue(mockError);

    const result = await tool.exec({ 
      usernameOrAlias: 'test@example.com',
      workItemNames: ['WI-001', 'WI-002']
    });

    // Verify the result shows error
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Work items not found');

    // Verify telemetry was sent with error info
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.PROMOTE_WORK_ITEM);
    expect(telemetryEvent.event.success).toBe(false);
    expect(telemetryEvent.event.error).toContain('Work items not found');
    expect(telemetryEvent.event.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should send telemetry on promotion error', async () => {
    const mockWorkItems = [
      {
        id: '1',
        name: 'WI-001',
        PipelineStageId: 'stage-1',
        TargetStageId: 'stage-2',
        PipelineId: 'pipeline-1'
      },
    ];
    const mockError = new Error('Promotion failed');

    vi.spyOn(getWorkItems, 'fetchWorkItemsByNames').mockResolvedValue(mockWorkItems);
    vi.spyOn(promoteWorkItems, 'promoteWorkItems').mockRejectedValue(mockError);

    const result = await tool.exec({ 
      usernameOrAlias: 'test@example.com',
      workItemNames: ['WI-001']
    });

    // Verify the result shows error
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Promotion failed');

    // Verify telemetry was sent with error info
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.PROMOTE_WORK_ITEM);
    expect(telemetryEvent.event.success).toBe(false);
    expect(telemetryEvent.event.error).toBe('Promotion failed');
    expect(telemetryEvent.event.workItemCount).toBe(1);
  });

  it('should work with alias as usernameOrAlias', async () => {
    const mockWorkItems = [
      {
        id: '1',
        name: 'WI-001',
        PipelineStageId: 'stage-1',
        TargetStageId: 'stage-2',
        PipelineId: 'pipeline-1'
      },
      {
        id: '2',
        name: 'WI-002',
        PipelineStageId: 'stage-1',
        TargetStageId: 'stage-2',
        PipelineId: 'pipeline-1'
      },
    ];

    vi.spyOn(getWorkItems, 'fetchWorkItemsByNames').mockResolvedValue(mockWorkItems);
    vi.spyOn(promoteWorkItems, 'promoteWorkItems').mockResolvedValue({
      requestId: 'req-123',
      status: 'Success'
    });

    const result = await tool.exec({ 
      usernameOrAlias: 'myDevOpsOrg',
      workItemNames: ['WI-001', 'WI-002']
    });

    // Verify the result
    expect(result.isError).toBeUndefined();

    // Verify telemetry was sent
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.PROMOTE_WORK_ITEM);
    expect(telemetryEvent.event.success).toBe(true);
    expect(telemetryEvent.event.workItemCount).toBe(2);
  });
});

