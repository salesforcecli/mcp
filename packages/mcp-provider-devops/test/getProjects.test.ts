import { describe, it, expect, vi } from 'vitest';
import { fetchProjects } from '../src/getProjects.js';

describe('fetchProjects', () => {
  it('should fetch projects successfully', async () => {
    const mockConnection = { query: vi.fn().mockResolvedValue({ records: [{ Id: 'P-001', Name: 'Project 1', Description: 'Test Project' }] }) };

    const projects = await fetchProjects(mockConnection);
    expect(projects).toHaveLength(1);
    expect(projects[0].Id).toBe('P-001');
    expect(projects[0].Name).toBe('Project 1');
  });

  it('should return an empty array if no projects are found', async () => {
    const mockConnection = { query: vi.fn().mockResolvedValue({ records: [] }) };

    const projects = await fetchProjects(mockConnection);
    expect(projects).toHaveLength(0);
  });

  it('should throw errors', async () => {
    const mockConnection = { query: vi.fn().mockRejectedValue(new Error('Network Error')) };

    await expect(fetchProjects(mockConnection)).rejects.toThrow('Network Error');
  });
});
