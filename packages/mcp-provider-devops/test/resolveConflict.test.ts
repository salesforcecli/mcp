import { resolveConflict } from '../src/resolveConflict.js';
import { WorkItem } from '../src/types/WorkItem.js';

describe('resolveConflict', () => {
  it('should return an error if no workItem is provided', async () => {
    const result = await resolveConflict({});
    expect(result.content[0].text).toContain('Error: Please provide a workItem to check for conflicts.');
  });

  it('should return an error if workItem is missing required properties', async () => {
    const workItem: WorkItem = {
      id: 'WI-0001',
      name: 'Test Work Item',
      status: 'New',
      owner: 'Test Owner',
      DevopsProjectId: '123',
      // Missing WorkItemBranch, TargetBranch, and SourceCodeRepository
    };
    const result = await resolveConflict({ workItem });
    expect(result.content[0].text).toContain('Error: Work item is missing required properties');
  });

  it('should return a resolution guide if workItem has all required properties', async () => {
    const workItem: WorkItem = {
      id: 'WI-0001',
      name: 'Test Work Item',
      status: 'New',
      owner: 'Test Owner',
      DevopsProjectId: '123',
      WorkItemBranch: 'feature-branch',
      TargetBranch: 'main',
      SourceCodeRepository: { repoUrl: 'https://example.com/repo.git', repoType: 'git' }
    };
    const result = await resolveConflict({ workItem });
    expect(result.content[0].text).toContain('Resolve merge conflicts for work item');
  });
});
