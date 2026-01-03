import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SfDevopsListProjects } from '../src/tools/sfDevopsListProjects.js';
import { SpyTelemetryService } from './test-doubles.js';
import { TelemetryEventNames } from '../src/constants.js';
import { Services } from '@salesforce/mcp-provider-api';
import { Connection } from '@salesforce/core';

describe('SfDevopsListProjects', () => {
  let tool: SfDevopsListProjects;
  let spyTelemetryService: SpyTelemetryService;
  let mockServices: Services;
  let mockConnection: Partial<Connection>;

  beforeEach(() => {
    spyTelemetryService = new SpyTelemetryService();
    
    // Mock Connection with query method
    mockConnection = {
      query: vi.fn(),
    };
    
    // Mock Services
    mockServices = {
      getTelemetryService: () => spyTelemetryService,
      getOrgService: () => ({
        getConnection: vi.fn().mockResolvedValue(mockConnection),
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
    
    tool = new SfDevopsListProjects(mockServices);
  });

  it('should send telemetry on successful project fetch with username', async () => {
    const mockProjects = [
      { Id: '1', Name: 'Project 1', Description: 'Test project 1' },
      { Id: '2', Name: 'Project 2', Description: 'Test project 2' },
    ];

    // Mock the connection query
    (mockConnection.query as any).mockResolvedValue({ records: mockProjects });

    const result = await tool.exec({ usernameOrAlias: 'test@example.com' });

    // Verify the result
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Project 1');

    // Verify telemetry was sent
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.LIST_PROJECTS);
    expect(telemetryEvent.event.success).toBe(true);
    expect(telemetryEvent.event.projectCount).toBe(2);
    expect(telemetryEvent.event.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should send telemetry on error', async () => {
    const mockError = new Error('Connection failed');

    // Mock the connection query to throw an error
    (mockConnection.query as any).mockRejectedValue(mockError);

    const result = await tool.exec({ usernameOrAlias: 'test@example.com' });

    // Verify the result shows error
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Connection failed');

    // Verify telemetry was sent with error info
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.LIST_PROJECTS);
    expect(telemetryEvent.event.success).toBe(false);
    expect(telemetryEvent.event.error).toBe('Connection failed');
    expect(telemetryEvent.event.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should send telemetry with zero count for empty project list', async () => {
    // Mock the connection query to return empty array
    (mockConnection.query as any).mockResolvedValue({ records: [] });

    const result = await tool.exec({ usernameOrAlias: 'test@example.com' });

    // Verify the result
    expect(result.isError).toBeUndefined();

    // Verify telemetry was sent with zero count
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.LIST_PROJECTS);
    expect(telemetryEvent.event.success).toBe(true);
    expect(telemetryEvent.event.projectCount).toBe(0);
  });

  it('should work with alias as usernameOrAlias', async () => {
    const mockProjects = [
      { Id: '1', Name: 'Project 1', Description: 'Test project 1' },
    ];

    // Mock the connection query
    (mockConnection.query as any).mockResolvedValue({ records: mockProjects });

    const result = await tool.exec({ usernameOrAlias: 'myDevOpsOrg' });

    // Verify the result
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Project 1');

    // Verify telemetry was sent
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.LIST_PROJECTS);
    expect(telemetryEvent.event.success).toBe(true);
    expect(telemetryEvent.event.projectCount).toBe(1);
  });

  it('should call getOrgService with usernameOrAlias', async () => {
    const mockProjects = [
      { Id: '1', Name: 'Project 1', Description: 'Test project 1' },
    ];

    const getConnectionSpy = vi.fn().mockResolvedValue(mockConnection);
    mockServices.getOrgService = () => ({
      getConnection: getConnectionSpy,
      getAllowedOrgUsernames: vi.fn(),
      getAllowedOrgs: vi.fn(),
      getDefaultTargetOrg: vi.fn(),
      getDefaultTargetDevHub: vi.fn(),
      findOrgByUsernameOrAlias: vi.fn(),
    });
    
    (mockConnection.query as any).mockResolvedValue({ records: mockProjects });

    const result = await tool.exec({ usernameOrAlias: 'test@example.com' });

    // Verify that getConnection was called with usernameOrAlias
    expect(getConnectionSpy).toHaveBeenCalledWith('test@example.com');
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Project 1');
  });

  it('should handle error when org service fails', async () => {
    const mockError = new Error('Invalid org');

    const getConnectionSpy = vi.fn().mockRejectedValue(mockError);
    mockServices.getOrgService = () => ({
      getConnection: getConnectionSpy,
      getAllowedOrgUsernames: vi.fn(),
      getAllowedOrgs: vi.fn(),
      getDefaultTargetOrg: vi.fn(),
      getDefaultTargetDevHub: vi.fn(),
      findOrgByUsernameOrAlias: vi.fn(),
    });

    const result = await tool.exec({ usernameOrAlias: 'invalidOrg' });

    // Verify the result shows error
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid org');

    // Verify telemetry was sent with error info
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.LIST_PROJECTS);
    expect(telemetryEvent.event.success).toBe(false);
    expect(telemetryEvent.event.error).toBe('Invalid org');
  });
});


