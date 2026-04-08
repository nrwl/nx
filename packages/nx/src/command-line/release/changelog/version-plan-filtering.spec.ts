import { RawVersionPlan } from '../config/version-plans';
import * as execCommandModule from '../utils/exec-command';
import * as gitUtils from '../utils/git';
import type { VersionData } from '../utils/shared';
import {
  extractPreidFromVersion,
  extractProjectsPreidFromVersionData,
  filterVersionPlansByCommitRange,
  resolveWorkspaceChangelogFromSHA,
} from './version-plan-filtering';

jest.mock('../utils/exec-command');
jest.mock('../utils/git');
jest.mock('../../../utils/workspace-root', () => ({
  workspaceRoot: '/',
}));

describe('version-plan-filtering', () => {
  const mockExecCommand = execCommandModule.execCommand as jest.Mock;
  const mockGetCommitHash = gitUtils.getCommitHash as jest.Mock;
  const mockGetFirstGitCommit = gitUtils.getFirstGitCommit as jest.Mock;
  const mockGetLatestGitTagForPattern =
    gitUtils.getLatestGitTagForPattern as jest.Mock;

  // Mock resolveRepositoryTags function for testing
  const mockResolveRepositoryTags = jest.fn().mockResolvedValue([]);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('filterVersionPlansByCommitRange', () => {
    const createMockVersionPlan = (
      fileName: string,
      absolutePath: string
    ): RawVersionPlan => ({
      fileName,
      absolutePath,
      relativePath: `.nx/version-plans/${fileName}`,
      createdOnMs: Date.now(),
      content: {},
      message: 'Test message',
    });

    it('should include version plans added within the commit range', async () => {
      const versionPlans = [
        createMockVersionPlan('plan-1.md', '/.nx/version-plans/plan-1.md'),
        createMockVersionPlan('plan-2.md', '/.nx/version-plans/plan-2.md'),
        createMockVersionPlan('plan-3.md', '/.nx/version-plans/plan-3.md'),
      ];

      // Mock git log response with files added in the range
      mockExecCommand.mockResolvedValue(
        '.nx/version-plans/plan-1.md\n.nx/version-plans/plan-3.md\n'
      );

      const result = await filterVersionPlansByCommitRange(
        versionPlans,
        'fromSHA',
        'toSHA',
        false
      );

      expect(result).toHaveLength(2);
      expect(result[0].fileName).toBe('plan-1.md');
      expect(result[1].fileName).toBe('plan-3.md');
    });

    it('should return empty array when there is a git error', async () => {
      const versionPlans = [
        createMockVersionPlan('plan-1.md', '/.nx/version-plans/plan-1.md'),
      ];

      mockExecCommand.mockRejectedValue(new Error('Git error'));

      const result = await filterVersionPlansByCommitRange(
        versionPlans,
        'fromSHA',
        'toSHA',
        false
      );

      // When git fails, we return empty array (no files were added in range)
      expect(result).toHaveLength(0);
    });

    it('should log verbose output when verbose is true', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const versionPlans = [
        createMockVersionPlan('plan-1.md', '/.nx/version-plans/plan-1.md'),
        createMockVersionPlan('plan-2.md', '/.nx/version-plans/plan-2.md'),
      ];

      mockExecCommand.mockResolvedValue('.nx/version-plans/plan-1.md\n');

      await filterVersionPlansByCommitRange(
        versionPlans,
        'fromSHA',
        'toSHA',
        true
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Found 1 version plan files added in commit range'
        )
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Version plan 'plan-1.md' was added in commit range"
        )
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Filtering out version plan')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Filtered 2 version plans down to 1')
      );

      consoleSpy.mockRestore();
    });

    it('should handle empty version plans array', async () => {
      const result = await filterVersionPlansByCommitRange(
        [],
        'fromSHA',
        'toSHA',
        false
      );

      expect(result).toEqual([]);
      expect(mockExecCommand).not.toHaveBeenCalled();
    });
  });

  describe('resolveWorkspaceChangelogFromSHA', () => {
    it('should resolve user-provided from ref to SHA', async () => {
      mockGetCommitHash.mockResolvedValue('resolved-sha');

      const result = await resolveWorkspaceChangelogFromSHA({
        args: { from: 'v1.0.0' } as any,
        nxReleaseConfig: {
          releaseTag: {
            pattern: '{version}',
            checkAllBranchesWhen: false,
            requireSemver: true,
            strictPreid: false,
          },
        } as any,
        useAutomaticFromRef: false,
        resolveRepositoryTags: mockResolveRepositoryTags,
      });

      expect(mockGetCommitHash).toHaveBeenCalledWith('v1.0.0');
      expect(result).toBe('resolved-sha');
    });

    it('should resolve from latest tag when no from ref provided', async () => {
      mockGetLatestGitTagForPattern.mockResolvedValue({ tag: 'v1.0.0' });
      mockGetCommitHash.mockResolvedValue('tag-sha');

      const result = await resolveWorkspaceChangelogFromSHA({
        args: { version: '2.0.0' } as any,
        nxReleaseConfig: {
          releaseTag: {
            pattern: '{version}',
            checkAllBranchesWhen: false,
            requireSemver: true,
            strictPreid: false,
          },
        } as any,
        useAutomaticFromRef: false,
        resolveRepositoryTags: mockResolveRepositoryTags,
      });

      expect(mockGetLatestGitTagForPattern).toHaveBeenCalled();
      expect(mockGetCommitHash).toHaveBeenCalledWith('v1.0.0');
      expect(result).toBe('tag-sha');
    });

    it('should use first commit when automatic from ref is enabled and no tag found', async () => {
      mockGetLatestGitTagForPattern.mockResolvedValue(null);
      mockGetFirstGitCommit.mockResolvedValue('first-commit-sha');

      const result = await resolveWorkspaceChangelogFromSHA({
        args: {} as any,
        nxReleaseConfig: {
          releaseTag: {
            pattern: '{version}',
            checkAllBranchesWhen: false,
            requireSemver: true,
            strictPreid: false,
          },
        } as any,
        useAutomaticFromRef: true,
        resolveRepositoryTags: mockResolveRepositoryTags,
      });

      expect(mockGetFirstGitCommit).toHaveBeenCalled();
      expect(result).toBe('first-commit-sha');
    });

    it('should return null when no from ref can be resolved', async () => {
      mockGetLatestGitTagForPattern.mockResolvedValue(null);

      const result = await resolveWorkspaceChangelogFromSHA({
        args: {} as any,
        nxReleaseConfig: {
          releaseTag: {
            pattern: '{version}',
            checkAllBranchesWhen: false,
            requireSemver: true,
            strictPreid: false,
          },
        } as any,
        useAutomaticFromRef: false,
        resolveRepositoryTags: mockResolveRepositoryTags,
      });

      expect(result).toBeNull();
    });

    it('should extract preid from prerelease version', async () => {
      const prereleaseSpyOn = jest
        .spyOn(require('semver'), 'prerelease')
        .mockReturnValue(['beta', 1]);
      mockGetLatestGitTagForPattern.mockResolvedValue({ tag: 'v2.0.0-beta.1' });
      mockGetCommitHash.mockResolvedValue('prerelease-sha');

      const result = await resolveWorkspaceChangelogFromSHA({
        args: { version: '2.0.0-beta.2' } as any,
        nxReleaseConfig: {
          releaseTag: {
            pattern: '{version}',
            checkAllBranchesWhen: false,
            requireSemver: true,
            strictPreid: true,
          },
        } as any,
        useAutomaticFromRef: false,
        resolveRepositoryTags: mockResolveRepositoryTags,
      });

      expect(mockGetLatestGitTagForPattern).toHaveBeenCalledWith(
        '{version}',
        {},
        mockResolveRepositoryTags,
        expect.objectContaining({
          preid: 'beta',
        })
      );
      expect(result).toBe('prerelease-sha');

      prereleaseSpyOn.mockRestore();
    });

    it('should handle version data with project preids', async () => {
      const prereleaseSpyOn = jest
        .spyOn(require('semver'), 'prerelease')
        .mockImplementation((version) =>
          typeof version === 'string' && version.includes('alpha')
            ? ['alpha', 1]
            : null
        );
      mockGetLatestGitTagForPattern.mockResolvedValue({
        tag: 'proj1-v1.0.0-alpha.1',
      });
      mockGetCommitHash.mockResolvedValue('project-sha');

      const result = await resolveWorkspaceChangelogFromSHA({
        args: {
          versionData: {
            proj1: { newVersion: '1.0.0-alpha.2' },
            proj2: { newVersion: '2.0.0' },
          },
        } as any,
        nxReleaseConfig: {
          releaseTag: {
            pattern: '{projectName}-v{version}',
            checkAllBranchesWhen: false,
            requireSemver: true,
            strictPreid: true,
          },
        } as any,
        useAutomaticFromRef: false,
        resolveRepositoryTags: mockResolveRepositoryTags,
      });

      expect(mockGetLatestGitTagForPattern).toHaveBeenCalledWith(
        '{projectName}-v{version}',
        {},
        mockResolveRepositoryTags,
        expect.objectContaining({
          preid: 'alpha',
        })
      );
      expect(result).toBe('project-sha');

      prereleaseSpyOn.mockRestore();
    });
  });

  describe('extractPreidFromVersion', () => {
    it('should extract preid from basic prerelease versions', () => {
      expect(extractPreidFromVersion('1.0.0-beta.1')).toBe('beta');
      expect(extractPreidFromVersion('2.0.0-alpha.5')).toBe('alpha');
      expect(extractPreidFromVersion('3.0.0-rc.2')).toBe('rc');
    });

    it('should return undefined for stable release versions', () => {
      expect(extractPreidFromVersion('1.0.0')).toBeUndefined();
      expect(extractPreidFromVersion('2.5.3')).toBeUndefined();
    });

    it('should return undefined for null undefined or empty input versions', () => {
      expect(extractPreidFromVersion(null)).toBeUndefined();
      expect(extractPreidFromVersion(undefined)).toBeUndefined();
      expect(extractPreidFromVersion('')).toBeUndefined();
    });

    it('should handle numeric preids by returning undefined value', () => {
      // Numeric preids like "1.0.0-0" have the preid as a number
      expect(extractPreidFromVersion('1.0.0-0')).toBeUndefined();
      expect(extractPreidFromVersion('1.0.0-1')).toBeUndefined();
    });

    it('should handle complex multi-part prerelease versions', () => {
      // Only the first part is considered the preid
      expect(extractPreidFromVersion('1.0.0-beta.1.exp.2')).toBe('beta');
      expect(extractPreidFromVersion('2.0.0-alpha.0.next.1')).toBe('alpha');
    });

    it('should handle prerelease versions containing dashes', () => {
      expect(extractPreidFromVersion('1.0.0-pre-release.1')).toBe(
        'pre-release'
      );
      expect(extractPreidFromVersion('1.0.0-my-custom-tag.5')).toBe(
        'my-custom-tag'
      );
    });
  });

  describe('extractProjectsPreidFromVersionData', () => {
    it('should extract preids from multiple project versions', () => {
      const versionData = {
        'project-a': {
          newVersion: '1.0.0-beta.1',
          currentVersion: '0.9.0',
          dependentProjects: [],
        },
        'project-b': {
          newVersion: '2.0.0-alpha.3',
          currentVersion: '1.9.0',
          dependentProjects: [],
        },
        'project-c': {
          newVersion: '3.0.0',
          currentVersion: '2.9.0',
          dependentProjects: [],
        },
      };

      const result = extractProjectsPreidFromVersionData(versionData);

      expect(result).toEqual({
        'project-a': 'beta',
        'project-b': 'alpha',
        'project-c': undefined,
      });
    });

    it('should return undefined for undefined versionData input', () => {
      expect(extractProjectsPreidFromVersionData(undefined)).toBeUndefined();
    });

    it('should handle empty versionData object', () => {
      expect(extractProjectsPreidFromVersionData({})).toEqual({});
    });

    it('should handle projects with missing or empty newVersion', () => {
      const versionData = {
        'project-a': {
          currentVersion: '1.0.0',
          newVersion: '',
          dependentProjects: [],
        },
        'project-b': {
          newVersion: '2.0.0-beta.1',
          currentVersion: '1.9.0',
          dependentProjects: [],
        },
      };

      const result = extractProjectsPreidFromVersionData(versionData);

      expect(result).toEqual({
        'project-b': 'beta',
      });
    });

    it('should handle projects with null or undefined newVersion fields', () => {
      const versionData = {
        'project-a': {
          newVersion: null,
          currentVersion: '1.0.0',
          dependentProjects: [],
        },
        'project-b': {
          newVersion: undefined,
          currentVersion: '1.9.0',
          dependentProjects: [],
        },
        'project-c': {
          newVersion: '3.0.0-rc.1',
          currentVersion: '2.9.0',
          dependentProjects: [],
        },
      };

      const result = extractProjectsPreidFromVersionData(
        versionData as unknown as VersionData
      );

      expect(result).toEqual({
        'project-c': 'rc',
      });
    });

    it('should handle projects with complex multi-part prerelease versions', () => {
      const versionData = {
        'project-a': {
          newVersion: '1.0.0-beta.1.exp.3',
          currentVersion: '0.9.0',
          dependentProjects: [],
        },
        'project-b': {
          newVersion: '2.0.0-pre-release.2',
          currentVersion: '1.9.0',
          dependentProjects: [],
        },
        'project-c': {
          newVersion: '3.0.0-0',
          currentVersion: '2.9.0',
          dependentProjects: [],
        }, // numeric preid
      };

      const result = extractProjectsPreidFromVersionData(versionData);

      expect(result).toEqual({
        'project-a': 'beta',
        'project-b': 'pre-release',
        'project-c': undefined, // numeric preids return undefined
      });
    });
  });
});
