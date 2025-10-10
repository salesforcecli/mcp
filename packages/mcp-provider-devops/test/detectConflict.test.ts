import { describe, it, expect, vi } from 'vitest';
import { detectConflict } from '../src/detectConflict.js';
import type { WorkItem } from '../src/types/WorkItem.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

describe('detectConflict', () => {
  it('should return an error if no workItem is provided', async () => {
    const result = await detectConflict({});
    expect(result.content[0].text).toContain('Error: Please provide a workItem to check for conflicts.');
  });

  it('should return an error if workItem is missing required properties', async () => {
    const workItem = {
      id: 'WI-0001',
      name: 'Test Work Item',
      // Missing WorkItemBranch, TargetBranch, and SourceCodeRepository
    } as unknown as WorkItem;
    const result = await detectConflict({ workItem });
    expect(result.content[0].text).toContain('Error: Work item is missing required properties');
  });

  it('should request correct path when localPath is not a git repo', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-conflict-nonrepo-'));
    try {
      const workItem: WorkItem = {
        id: 'WI-0002',
        name: 'Repo Check',
        WorkItemBranch: 'feature/abc',
        TargetBranch: 'main',
        SourceCodeRepository: { repoUrl: 'https://example.com/repo.git' }
      } as unknown as WorkItem;
      const result = await detectConflict({ workItem, localPath: tmpDir });
      expect(result.content[0].text).toContain('is not a Git repository');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should block when uncommitted changes exist in localPath', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-conflict-dirtyrepo-'));
    try {
      // Initialize a git repository
      execSync('git init', { cwd: tmpDir });
      execSync('git config user.email "test@example.com"', { cwd: tmpDir });
      execSync('git config user.name "Test User"', { cwd: tmpDir });
      // Create initial commit
      fs.writeFileSync(path.join(tmpDir, 'README.md'), 'initial');
      execSync('git add README.md', { cwd: tmpDir });
      execSync('git commit -m "init"', { cwd: tmpDir });
      // Create uncommitted change
      fs.writeFileSync(path.join(tmpDir, 'README.md'), 'changed');

      const workItem: WorkItem = {
        id: 'WI-0003',
        name: 'Dirty Repo Check',
        WorkItemBranch: 'feature/xyz',
        TargetBranch: 'main',
        SourceCodeRepository: { repoUrl: 'https://example.com/repo.git' }
      } as unknown as WorkItem;

      const result = await detectConflict({ workItem, localPath: tmpDir });
      expect(result.content[0].text).toContain('Local changes detected');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
