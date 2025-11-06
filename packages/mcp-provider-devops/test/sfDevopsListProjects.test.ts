import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SfDevopsListProjects } from '../src/tools/sfDevopsListProjects.js';
import { SpyTelemetryService } from './test-doubles.js';
import { TelemetryEventNames } from '../src/constants.js';
import * as getProjectsModule from '../src/getProjects.js';

describe('SfDevopsListProjects Telemetry', () => {
  let tool: SfDevopsListProjects;
  let spyTelemetryService: SpyTelemetryService;

  beforeEach(() => {
    spyTelemetryService = new SpyTelemetryService();
    tool = new SfDevopsListProjects(spyTelemetryService);
  });

  it('should send telemetry on successful project fetch', async () => {
    const mockProjects = [
      { Id: '1', Name: 'Project 1', Description: 'Test project 1' },
      { Id: '2', Name: 'Project 2', Description: 'Test project 2' },
    ];

    // Mock the fetchProjects function
    vi.spyOn(getProjectsModule, 'fetchProjects').mockResolvedValue(mockProjects);

    const result = await tool.exec({ username: 'test@example.com' });

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

    // Mock the fetchProjects function to throw an error
    vi.spyOn(getProjectsModule, 'fetchProjects').mockRejectedValue(mockError);

    const result = await tool.exec({ username: 'test@example.com' });

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
    // Mock the fetchProjects function to return empty array
    vi.spyOn(getProjectsModule, 'fetchProjects').mockResolvedValue([]);

    const result = await tool.exec({ username: 'test@example.com' });

    // Verify the result
    expect(result.isError).toBeUndefined();

    // Verify telemetry was sent with zero count
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.LIST_PROJECTS);
    expect(telemetryEvent.event.success).toBe(true);
    expect(telemetryEvent.event.projectCount).toBe(0);
  });
});

