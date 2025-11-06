import { describe, it, expect, vi } from 'vitest';
import { fetchProjects } from '../src/getProjects.js';
import { getConnection } from '../src/shared/auth.js';

vi.mock('../src/shared/auth');

describe('fetchProjects', () => {
  it('should fetch projects successfully', async () => {
    const mockConnection = { query: vi.fn().mockResolvedValue({ records: [{ Id: 'P-001', Name: 'Project 1', Description: 'Test Project' }] }) };
    (getConnection as vi.Mock).mockResolvedValue(mockConnection);

    const projects = await fetchProjects('test-user');
    expect(projects).toHaveLength(1);
    expect(projects[0].Id).toBe('P-001');
    expect(projects[0].Name).toBe('Project 1');
  });

  it('should return an empty array if no projects are found', async () => {
    const mockConnection = { query: vi.fn().mockResolvedValue({ records: [] }) };
    (getConnection as vi.Mock).mockResolvedValue(mockConnection);

    const projects = await fetchProjects('test-user');
    expect(projects).toHaveLength(0);
  });

  it('should throw errors', async () => {
    const mockConnection = { query: vi.fn().mockRejectedValue(new Error('Network Error')) };
    (getConnection as vi.Mock).mockResolvedValue(mockConnection);

    await expect(fetchProjects('test-user')).rejects.toThrow('Network Error');
  });
});
