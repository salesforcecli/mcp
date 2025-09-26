import { describe, it, expect, vi } from 'vitest';
import { checkoutWorkitemBranch } from '../src/checkoutWorkitemBranch.js';
import { exec } from 'child_process';
import fs from 'fs';

vi.mock('child_process');
vi.mock('fs');

describe('checkoutWorkitemBranch', () => {
  const mockExec = (command: string, options: any, callback: (error: any, stdout: string, stderr: string) => void) => {
    if (command.includes('git status --porcelain')) {
      callback(null, '', '');
    } else if (command.includes('git branch --list')) {
      callback(null, '  main\n* feature-branch', '');
    } else if (command.includes('git remote get-url origin')) {
      callback(null, 'https://example.com/repo.git', '');
    } else {
      callback(null, 'Success', '');
    }
  };

  beforeEach(() => {
    (exec as vi.Mock).mockImplementation(mockExec);
    (fs.existsSync as vi.Mock).mockReturnValue(true);
  });

  it('should return an error if inside a git repository without localPath', async () => {
    (fs.existsSync as vi.Mock).mockImplementation((path: string) => path.includes('.git'));

    const result = await checkoutWorkitemBranch({
      repoUrl: 'https://example.com/repo.git',
      branchName: 'feature-branch'
    });

    expect(result.content[0].text).toContain('You are currently inside a git repository. Please specify a different directory (localPath) to clone the new repository.');
  });

  it('should checkout an existing branch successfully', async () => {
    const result = await checkoutWorkitemBranch({
      repoUrl: 'https://example.com/repo.git',
      branchName: 'feature-branch',
      localPath: '/mocked/path/to/repo'
    });

    expect(result.content[0].text).toContain('Fetched remote, checked out existing branch \'feature-branch\', and pulled latest changes.');
  });

  it('should return an error if the directory is not a git repository', async () => {
    (fs.existsSync as vi.Mock).mockImplementation((path: string) => !path.includes('.git'));

    const result = await checkoutWorkitemBranch({
      repoUrl: 'https://example.com/repo.git',
      branchName: 'feature-branch',
      localPath: '/mocked/path/to/repo'
    });

    expect(result.content[0].text).toContain('The directory at /mocked/path/to/repo is not a git repository.');
  });

  it('should return an error if the repoUrl does not match', async () => {
    (exec as vi.Mock).mockImplementation((command: string, options: any, callback: (error: any, stdout: string, stderr: string) => void) => {
      if (command.includes('git remote get-url origin')) {
        callback(null, 'https://different.com/repo.git', '');
      } else {
        callback(null, 'Success', '');
      }
    });

    const result = await checkoutWorkitemBranch({
      repoUrl: 'https://example.com/repo.git',
      branchName: 'feature-branch',
      localPath: '/mocked/path/to/repo'
    });

    expect(result.content[0].text).toContain('The repository at /mocked/path/to/repo does not match the provided repoUrl.');
  });
});
