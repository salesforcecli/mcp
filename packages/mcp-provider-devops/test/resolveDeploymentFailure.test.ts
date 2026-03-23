import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as dependencyInBranch from '../src/shared/dependencyInBranch.js';
import {
  canFullPromotionFixFailure,
  type ResolveDeploymentFailureOptions,
} from '../src/resolveDeploymentFailure.js';

describe('resolveDeploymentFailure', () => {
  const defaultOptions: ResolveDeploymentFailureOptions = {
    localPath: '/repo',
    sourceBranchName: 'feature/abc',
    targetBranchName: 'main',
  };

  beforeEach(() => {
    vi.spyOn(dependencyInBranch, 'parseMissingDependency').mockReturnValue(null);
    vi.spyOn(dependencyInBranch, 'getSourcePathsForDependency').mockReturnValue([]);
    vi.spyOn(dependencyInBranch, 'isDependencyPresentInBranch').mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('merge conflict errors', () => {
    it('returns canFix false with reason merge_conflict when error contains MERGE_CONFLICT', () => {
      const result = canFullPromotionFixFailure('Deployment failed: MERGE_CONFLICT in file x');
      expect(result).toEqual({ canFix: false, reason: 'merge_conflict' });
      expect(dependencyInBranch.parseMissingDependency).not.toHaveBeenCalled();
    });

    it('returns canFix false with reason merge_conflict when error contains CONFLICTS:', () => {
      const result = canFullPromotionFixFailure('CONFLICTS: file1.cls, file2.cls');
      expect(result).toEqual({ canFix: false, reason: 'merge_conflict' });
    });

    it('treats merge conflict check case-insensitively', () => {
      expect(canFullPromotionFixFailure('merge_conflict detected')).toEqual({
        canFix: false,
        reason: 'merge_conflict',
      });
      expect(canFullPromotionFixFailure('conflicts: in branch')).toEqual({
        canFix: false,
        reason: 'merge_conflict',
      });
    });
  });

  describe('no dependency parsed', () => {
    it('returns canFix false with reason no_dependency_parsed when parseMissingDependency returns null', () => {
      (dependencyInBranch.parseMissingDependency as ReturnType<typeof vi.fn>).mockReturnValue(null);
      const result = canFullPromotionFixFailure('Some generic deployment error');
      expect(result).toEqual({ canFix: false, reason: 'no_dependency_parsed' });
    });
  });

  describe('dependency parsed', () => {
    const missingDependency = { type: 'ApexClass', name: 'TestFive' };
    const sourcePaths = ['force-app/main/default/classes/TestFive.cls'];

    beforeEach(() => {
      (dependencyInBranch.parseMissingDependency as ReturnType<typeof vi.fn>).mockReturnValue(
        missingDependency
      );
      (dependencyInBranch.getSourcePathsForDependency as ReturnType<typeof vi.fn>).mockReturnValue(
        sourcePaths
      );
    });

    it('returns canFix false with reason local_path_required when options is undefined', () => {
      const result = canFullPromotionFixFailure('no ApexClass named TestFive found');
      expect(result).toEqual({
        canFix: false,
        reason: 'local_path_required',
        missingDependencyName: 'TestFive',
      });
      expect(dependencyInBranch.isDependencyPresentInBranch).not.toHaveBeenCalled();
    });

    it('returns canFix false with reason dependency_not_in_source_branch when dependency not in source', () => {
      (dependencyInBranch.isDependencyPresentInBranch as ReturnType<typeof vi.fn>).mockReturnValue(
        false
      );
      const result = canFullPromotionFixFailure(
        'no ApexClass named TestFive found',
        defaultOptions
      );
      expect(result).toEqual({
        canFix: false,
        reason: 'dependency_not_in_source_branch',
        missingDependencyName: 'TestFive',
      });
      expect(dependencyInBranch.isDependencyPresentInBranch).toHaveBeenCalledWith(
        defaultOptions.localPath,
        defaultOptions.sourceBranchName,
        sourcePaths
      );
    });

    it('returns canFix false when getSourcePathsForDependency returns empty paths', () => {
      (dependencyInBranch.getSourcePathsForDependency as ReturnType<typeof vi.fn>).mockReturnValue(
        []
      );
      const result = canFullPromotionFixFailure(
        'no ApexClass named TestFive found',
        defaultOptions
      );
      expect(result).toEqual({
        canFix: false,
        reason: 'dependency_not_in_source_branch',
        missingDependencyName: 'TestFive',
      });
    });

    it('returns canFix true with reason dependency_in_source_branch when dependency is in source branch', () => {
      (dependencyInBranch.isDependencyPresentInBranch as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
      const result = canFullPromotionFixFailure(
        'no ApexClass named TestFive found',
        defaultOptions
      );
      expect(result).toEqual({
        canFix: true,
        reason: 'dependency_in_source_branch',
        missingDependencyName: 'TestFive',
        inTargetBranch: false,
      });
      expect(dependencyInBranch.isDependencyPresentInBranch).toHaveBeenCalledTimes(2);
      expect(dependencyInBranch.isDependencyPresentInBranch).toHaveBeenNthCalledWith(
        1,
        defaultOptions.localPath,
        defaultOptions.sourceBranchName,
        sourcePaths
      );
      expect(dependencyInBranch.isDependencyPresentInBranch).toHaveBeenNthCalledWith(
        2,
        defaultOptions.localPath,
        defaultOptions.targetBranchName,
        sourcePaths
      );
    });

    it('returns inTargetBranch true when dependency is in both source and target branch', () => {
      (dependencyInBranch.isDependencyPresentInBranch as ReturnType<typeof vi.fn>).mockReturnValue(
        true
      );
      const result = canFullPromotionFixFailure(
        'no ApexClass named TestFive found',
        defaultOptions
      );
      expect(result).toEqual({
        canFix: true,
        reason: 'dependency_in_source_branch',
        missingDependencyName: 'TestFive',
        inTargetBranch: true,
      });
    });

    it('omits inTargetBranch when targetBranchName is not provided', () => {
      (dependencyInBranch.isDependencyPresentInBranch as ReturnType<typeof vi.fn>).mockReturnValue(
        true
      );
      const optionsWithoutTarget: ResolveDeploymentFailureOptions = {
        localPath: defaultOptions.localPath,
        sourceBranchName: defaultOptions.sourceBranchName,
      };
      const result = canFullPromotionFixFailure(
        'no ApexClass named TestFive found',
        optionsWithoutTarget
      );
      expect(result).toEqual({
        canFix: true,
        reason: 'dependency_in_source_branch',
        missingDependencyName: 'TestFive',
        inTargetBranch: undefined,
      });
      expect(dependencyInBranch.isDependencyPresentInBranch).toHaveBeenCalledTimes(1);
    });
  });
});
