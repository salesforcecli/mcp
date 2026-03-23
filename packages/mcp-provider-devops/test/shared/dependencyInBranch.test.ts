import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from 'node:child_process';
import {
  parseMissingDependency,
  getSourcePathsForDependency,
  isDependencyPresentInBranch,
} from '../../src/shared/dependencyInBranch.js';

const mockExecFileSync = vi.mocked(execFileSync);

describe('shared/dependencyInBranch', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('parseMissingDependency', () => {
    it('returns ApexClass for "Variable does not exist: X"', () => {
      expect(parseMissingDependency('Variable does not exist: Sam_hello')).toEqual({
        type: 'ApexClass',
        name: 'Sam_hello',
      });
      expect(parseMissingDependency('Error: Variable does not exist: MyClass123')).toEqual({
        type: 'ApexClass',
        name: 'MyClass123',
      });
    });

    it('is case-insensitive for Variable does not exist', () => {
      expect(parseMissingDependency('variable does not exist: Test')).toEqual({
        type: 'ApexClass',
        name: 'Test',
      });
    });

    it('returns type and name for "no ApexClass named X found"', () => {
      expect(parseMissingDependency('no ApexClass named TestFive found')).toEqual({
        type: 'ApexClass',
        name: 'TestFive',
      });
      expect(parseMissingDependency('no ApexTrigger named MyTrigger found')).toEqual({
        type: 'ApexTrigger',
        name: 'MyTrigger',
      });
      expect(parseMissingDependency('no ApexPage named MyPage found')).toEqual({
        type: 'ApexPage',
        name: 'MyPage',
      });
      expect(parseMissingDependency('no CustomObject named Account found')).toEqual({
        type: 'CustomObject',
        name: 'Account',
      });
      expect(parseMissingDependency('no Flow named My_Flow found')).toEqual({
        type: 'Flow',
        name: 'My_Flow',
      });
    });

    it('returns ApexClass for "In field: apexClass - no ApexClass named X found"', () => {
      expect(
        parseMissingDependency('In field: apexClass - no ApexClass named TestFive found (profiles/Admin.profile-meta.xml)')
      ).toEqual({ type: 'ApexClass', name: 'TestFive' });
    });

    it('returns from Type: and Component: when present and not Variable/Problem', () => {
      expect(
        parseMissingDependency('unknown component. Type: ApexClass. Component: MyClass')
      ).toEqual({ type: 'ApexClass', name: 'MyClass' });
      expect(
        parseMissingDependency('Component: MyTrigger, Type: ApexTrigger')
      ).toEqual({ type: 'ApexTrigger', name: 'MyTrigger' });
    });

    it('prefers Variable does not exist over other patterns', () => {
      const s = 'Variable does not exist: Foo. Type: ApexTrigger. Component: Bar';
      expect(parseMissingDependency(s)).toEqual({ type: 'ApexClass', name: 'Foo' });
    });

    it('does not return Type/Component when "Problem:" is in the message', () => {
      const s = 'Problem: something failed. Type: ApexClass. Component: X';
      expect(parseMissingDependency(s)).toBeNull();
    });

    it('returns null for generic errors', () => {
      expect(parseMissingDependency('Deployment failed')).toBeNull();
      expect(parseMissingDependency('Unknown error')).toBeNull();
      expect(parseMissingDependency('')).toBeNull();
    });
  });

  describe('getSourcePathsForDependency', () => {
    it('returns class paths for ApexClass', () => {
      const paths = getSourcePathsForDependency('ApexClass', 'TestFive');
      expect(paths).toEqual([
        'force-app/main/default/classes/TestFive.cls',
        'main/default/classes/TestFive.cls',
        'classes/TestFive.cls',
      ]);
    });

    it('returns trigger paths for ApexTrigger', () => {
      const paths = getSourcePathsForDependency('ApexTrigger', 'MyTrigger');
      expect(paths).toEqual([
        'force-app/main/default/triggers/MyTrigger.trigger',
        'main/default/triggers/MyTrigger.trigger',
      ]);
    });

    it('returns page paths for ApexPage', () => {
      const paths = getSourcePathsForDependency('ApexPage', 'MyPage');
      expect(paths).toEqual([
        'force-app/main/default/pages/MyPage.page',
        'main/default/pages/MyPage.page',
      ]);
    });

    it('returns profile paths for Profile', () => {
      const paths = getSourcePathsForDependency('Profile', 'Admin');
      expect(paths).toEqual([
        'force-app/main/default/profiles/Admin.profile-meta.xml',
        'main/default/profiles/Admin.profile-meta.xml',
      ]);
    });

    it('returns object paths for CustomObject', () => {
      const paths = getSourcePathsForDependency('CustomObject', 'Account');
      expect(paths).toEqual([
        'force-app/main/default/objects/Account/Account.object-meta.xml',
        'main/default/objects/Account/Account.object-meta.xml',
      ]);
    });

    it('returns flow paths for Flow', () => {
      const paths = getSourcePathsForDependency('Flow', 'My_Flow');
      expect(paths).toEqual([
        'force-app/main/default/flows/My_Flow.flow-meta.xml',
        'main/default/flows/My_Flow.flow-meta.xml',
      ]);
    });

    it('normalizes type to first-letter uppercase', () => {
      expect(getSourcePathsForDependency('apexClass', 'X')).toEqual([
        'force-app/main/default/classes/X.cls',
        'main/default/classes/X.cls',
        'classes/X.cls',
      ]);
    });

    it('returns empty array for unknown type', () => {
      expect(getSourcePathsForDependency('UnknownType', 'X')).toEqual([]);
      expect(getSourcePathsForDependency('Layout', 'MyLayout')).toEqual([]);
    });
  });

  describe('isDependencyPresentInBranch', () => {
    const repoPath = '/tmp/repo';
    const branch = 'feature/abc';
    const paths = ['force-app/main/default/classes/Test.cls', 'classes/Test.cls'];

    beforeEach(() => {
      mockExecFileSync.mockReturnValue('');
    });

    it('returns true when git show succeeds for first path', () => {
      const result = isDependencyPresentInBranch(repoPath, branch, paths);
      expect(result).toBe(true);
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'git',
        ['show', `${branch}:force-app/main/default/classes/Test.cls`],
        expect.objectContaining({ cwd: repoPath })
      );
    });

    it('returns true when git show succeeds for second path after first fails', () => {
      mockExecFileSync
        .mockImplementationOnce(() => {
          throw new Error('not found');
        })
        .mockReturnValueOnce('');
      const result = isDependencyPresentInBranch(repoPath, branch, paths);
      expect(result).toBe(true);
      expect(mockExecFileSync).toHaveBeenCalledTimes(2);
    });

    it('returns false when git show fails for all paths', () => {
      mockExecFileSync.mockImplementation(() => {
        throw new Error('not found');
      });
      const result = isDependencyPresentInBranch(repoPath, branch, paths);
      expect(result).toBe(false);
    });

    it('tries branch then origin/branch for each path', () => {
      mockExecFileSync
        .mockImplementationOnce(() => {
          throw new Error('invalid ref');
        })
        .mockReturnValueOnce('');
      const result = isDependencyPresentInBranch(repoPath, branch, ['classes/Test.cls']);
      expect(result).toBe(true);
      expect(mockExecFileSync).toHaveBeenNthCalledWith(
        1,
        'git',
        ['show', `${branch}:classes/Test.cls`],
        expect.any(Object)
      );
      expect(mockExecFileSync).toHaveBeenNthCalledWith(
        2,
        'git',
        ['show', `origin/${branch}:classes/Test.cls`],
        expect.any(Object)
      );
    });

    it('returns false for empty paths array', () => {
      const result = isDependencyPresentInBranch(repoPath, branch, []);
      expect(result).toBe(false);
      expect(mockExecFileSync).not.toHaveBeenCalled();
    });
  });
});
