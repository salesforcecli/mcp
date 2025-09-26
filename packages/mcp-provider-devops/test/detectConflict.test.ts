import { describe, it, expect, vi } from 'vitest';
import { detectConflict } from '../src/detectConflict.js';
import type { WorkItem } from '../src/types/WorkItem.js';

describe('detectConflict', () => {
  it('should return an error if no workItem is provided', async () => {
    const result = await detectConflict({});
    expect(result.content[0].text).toContain('Error: Please provide a workItem to check for conflicts.');
  });

  it('should return an error if workItem is missing required properties', async () => {
    const workItem: WorkItem = {
      id: 'WI-0001',
      name: 'Test Work Item',
      // Missing WorkItemBranch, TargetBranch, and SourceCodeRepository
    };
    const result = await detectConflict({ workItem });
    expect(result.content[0].text).toContain('Error: Work item is missing required properties');
  });

  it('should detect conflicts successfully', async () => {
    const workItem: WorkItem = {
      id: 'WI-0001',
      name: 'Test Work Item',
      WorkItemBranch: 'feature-branch',
      TargetBranch: 'main',
      SourceCodeRepository: { repoUrl: 'https://example.com/repo.git' }
    };
    const result = await detectConflict({ workItem, localPath: '/path/to/repo' });
    expect(result.content[0].text).toContain('Detect merge conflicts for work item');
  });
});
