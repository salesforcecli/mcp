import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SfDevopsListProjects } from '../src/tools/sfDevopsListProjects.js';
import { SpyTelemetryService } from './test-doubles.js';
import { TelemetryEventNames } from '../src/constants.js';
import * as getProjectsModule from '../src/getProjects.js';

describe('SfDevopsListProjects', () => {
  let tool: SfDevopsListProjects;
  let spyTelemetryService: SpyTelemetryService;

  beforeEach(() => {
    spyTelemetryService = new SpyTelemetryService();
    tool = new SfDevopsListProjects(spyTelemetryService);
  });

  describe('validateAndPrepare', () => {
    it('should return usernameOrAlias when username is provided', () => {
      // Access private method for testing via type assertion
      const result = (tool as any).validateAndPrepare({ username: 'test@example.com' });
      
      expect(result).toHaveProperty('usernameOrAlias');
      expect(result.usernameOrAlias).toBe('test@example.com');
      expect(result).not.toHaveProperty('error');
    });

    it('should return usernameOrAlias when alias is provided', () => {
      const result = (tool as any).validateAndPrepare({ alias: 'myDevOpsOrg' });
      
      expect(result).toHaveProperty('usernameOrAlias');
      expect(result.usernameOrAlias).toBe('myDevOpsOrg');
      expect(result).not.toHaveProperty('error');
    });

    it('should prioritize username over alias when both are provided', () => {
      const result = (tool as any).validateAndPrepare({ 
        username: 'test@example.com', 
        alias: 'myDevOpsOrg' 
      });
      
      expect(result).toHaveProperty('usernameOrAlias');
      expect(result.usernameOrAlias).toBe('test@example.com');
      expect(result).not.toHaveProperty('error');
    });

    it('should return error when neither username nor alias is provided', () => {
      const result = (tool as any).validateAndPrepare({});
      
      expect(result).toHaveProperty('error');
      expect(result.error.isError).toBe(true);
      expect(result.error.content[0].text).toContain('Username or alias of valid DevOps Center org is required');
    });

    it('should return error when username is empty string', () => {
      const result = (tool as any).validateAndPrepare({ username: '' });
      
      expect(result).toHaveProperty('error');
      expect(result.error.isError).toBe(true);
      expect(result.error.content[0].text).toContain('Username or alias of valid DevOps Center org is required');
    });

    it('should return error when alias is empty string', () => {
      const result = (tool as any).validateAndPrepare({ alias: '' });
      
      expect(result).toHaveProperty('error');
      expect(result.error.isError).toBe(true);
      expect(result.error.content[0].text).toContain('Username or alias of valid DevOps Center org is required');
    });
  });

  describe('Telemetry and Integration', () => {

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

  it('should work with alias instead of username', async () => {
    const mockProjects = [
      { Id: '1', Name: 'Project 1', Description: 'Test project 1' },
    ];

    // Mock the fetchProjects function
    vi.spyOn(getProjectsModule, 'fetchProjects').mockResolvedValue(mockProjects);

    const result = await tool.exec({ alias: 'myDevOpsOrg' });

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

  it('should prioritize username when both username and alias are provided', async () => {
    const mockProjects = [
      { Id: '1', Name: 'Project 1', Description: 'Test project 1' },
    ];

    const fetchProjectsSpy = vi.spyOn(getProjectsModule, 'fetchProjects').mockResolvedValue(mockProjects);

    const result = await tool.exec({ username: 'test@example.com', alias: 'myDevOpsOrg' });

    // Verify that fetchProjects was called with username (not alias)
    expect(fetchProjectsSpy).toHaveBeenCalledWith('test@example.com');
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Project 1');
  });

  it('should return error when neither username nor alias is provided', async () => {
    const result = await tool.exec({});

    // Verify the result shows error
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Username or alias of valid DevOps Center org is required');

    // Verify no telemetry was sent (error happens before API call)
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(0);
  });

  it('should handle error with alias input', async () => {
    const mockError = new Error('Invalid alias');

    // Mock the fetchProjects function to throw an error
    vi.spyOn(getProjectsModule, 'fetchProjects').mockRejectedValue(mockError);

    const result = await tool.exec({ alias: 'invalidAlias' });

    // Verify the result shows error
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid alias');

    // Verify telemetry was sent with error info
    expect(spyTelemetryService.sendEventCallHistory).toHaveLength(1);
    
    const telemetryEvent = spyTelemetryService.sendEventCallHistory[0];
    expect(telemetryEvent.eventName).toBe(TelemetryEventNames.LIST_PROJECTS);
    expect(telemetryEvent.event.success).toBe(false);
    expect(telemetryEvent.event.error).toBe('Invalid alias');
  });
  });
});

