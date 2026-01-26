import { ReleaseType } from 'semver';
import {
  createChangesFromGroupVersionPlans,
  createChangesFromProjectsVersionPlans,
  extractVersionPlanMetadata,
  versionPlanSemverReleaseTypeToChangelogType,
} from './version-plan-utils';
import { GroupVersionPlan, ProjectsVersionPlan } from '../config/version-plans';
import { RawGitCommit } from '../utils/git';

describe('version-plan-utils', () => {
  describe('versionPlanSemverReleaseTypeToChangelogType', () => {
    it('should map major and premajor to feat with breaking', () => {
      expect(versionPlanSemverReleaseTypeToChangelogType('major')).toEqual({
        type: 'feat',
        isBreaking: true,
      });
      expect(versionPlanSemverReleaseTypeToChangelogType('premajor')).toEqual({
        type: 'feat',
        isBreaking: true,
      });
    });

    it('should map minor and preminor to feat without breaking', () => {
      expect(versionPlanSemverReleaseTypeToChangelogType('minor')).toEqual({
        type: 'feat',
        isBreaking: false,
      });
      expect(versionPlanSemverReleaseTypeToChangelogType('preminor')).toEqual({
        type: 'feat',
        isBreaking: false,
      });
    });

    it('should map patch, prepatch, and prerelease to fix without breaking', () => {
      expect(versionPlanSemverReleaseTypeToChangelogType('patch')).toEqual({
        type: 'fix',
        isBreaking: false,
      });
      expect(versionPlanSemverReleaseTypeToChangelogType('prepatch')).toEqual({
        type: 'fix',
        isBreaking: false,
      });
      expect(versionPlanSemverReleaseTypeToChangelogType('prerelease')).toEqual(
        {
          type: 'fix',
          isBreaking: false,
        }
      );
    });

    it('should throw an error for invalid bump type', () => {
      expect(() =>
        versionPlanSemverReleaseTypeToChangelogType('invalid' as ReleaseType)
      ).toThrow('Invalid semver bump type: invalid');
    });
  });

  describe('extractVersionPlanMetadata', () => {
    it('should return empty metadata for null commit', () => {
      expect(extractVersionPlanMetadata(null)).toEqual({
        githubReferences: [],
        authors: undefined,
      });
    });

    it('should extract metadata from valid commit', () => {
      const mockCommit: RawGitCommit = {
        message: 'fix: some fix (#123)',
        body: 'Co-authored-by: John Doe <john@example.com>',
        shortHash: 'abc123',
        author: {
          name: 'Jane Doe',
          email: 'jane@example.com',
        },
      };
      const result = extractVersionPlanMetadata(mockCommit);
      expect(result).toMatchInlineSnapshot(`
        {
          "authors": [
            {
              "email": "jane@example.com",
              "name": "Jane Doe",
            },
            {
              "email": "john@example.com",
              "name": "John Doe",
            },
          ],
          "githubReferences": [
            {
              "type": "pull-request",
              "value": "#123",
            },
            {
              "type": "hash",
              "value": "abc123",
            },
          ],
        }
      `);
    });
  });

  describe('createChangesFromGroupVersionPlans', () => {
    it('should create changes for group version plans without triggered projects', () => {
      const versionPlans: GroupVersionPlan[] = [
        {
          groupVersionBump: 'minor',
          message: 'New feature added',
          commit: null,
          triggeredByProjects: undefined,
          fileName: 'version-plan-1.md',
          createdOnMs: 123456789,
          absolutePath: '/path/to/version-plan-1.md',
          relativePath: '.nx/version-plans/version-plan-1.md',
        },
      ];

      const changes = createChangesFromGroupVersionPlans(versionPlans);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        type: 'feat',
        scope: '',
        description: 'New feature added',
        body: '',
        isBreaking: false,
        githubReferences: [],
        authors: undefined,
        affectedProjects: '*',
      });
    });

    it('should create changes for group version plans with triggered projects', () => {
      const versionPlans: GroupVersionPlan[] = [
        {
          groupVersionBump: 'major',
          message: 'Breaking change',
          commit: null,
          triggeredByProjects: ['proj1', 'proj2'],
          fileName: 'version-plan-2.md',
          createdOnMs: 123456789,
          absolutePath: '/path/to/version-plan-2.md',
          relativePath: '.nx/version-plans/version-plan-2.md',
        },
      ];

      const changes = createChangesFromGroupVersionPlans(versionPlans);

      expect(changes).toHaveLength(2);
      expect(changes[0]).toEqual({
        type: 'feat',
        scope: 'proj1',
        description: 'Breaking change',
        body: '',
        isBreaking: true,
        githubReferences: [],
        authors: undefined,
        affectedProjects: ['proj1'],
      });
      expect(changes[1]).toEqual({
        type: 'feat',
        scope: 'proj2',
        description: 'Breaking change',
        body: '',
        isBreaking: true,
        githubReferences: [],
        authors: undefined,
        affectedProjects: ['proj2'],
      });
    });
  });

  describe('createChangesFromProjectsVersionPlans', () => {
    it('should create changes for project version plans', () => {
      const versionPlans: ProjectsVersionPlan[] = [
        {
          projectVersionBumps: {
            'my-project': 'patch',
            'other-project': 'minor',
          },
          message: 'Fix bug in my-project',
          commit: null,
          fileName: 'version-plan-3.md',
          createdOnMs: 123456789,
          absolutePath: '/path/to/version-plan-3.md',
          relativePath: '.nx/version-plans/version-plan-3.md',
        },
      ];

      const changes = createChangesFromProjectsVersionPlans(
        versionPlans,
        'my-project'
      );

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        type: 'fix',
        scope: 'my-project',
        description: 'Fix bug in my-project',
        body: '',
        isBreaking: false,
        affectedProjects: ['my-project', 'other-project'],
        githubReferences: [],
        authors: undefined,
      });
    });

    it('should filter out version plans that do not affect the specified project', () => {
      const versionPlans: ProjectsVersionPlan[] = [
        {
          projectVersionBumps: {
            'other-project': 'minor',
          },
          message: 'Update other project',
          commit: null,
          fileName: 'version-plan-4.md',
          createdOnMs: 123456789,
          absolutePath: '/path/to/version-plan-4.md',
          relativePath: '.nx/version-plans/version-plan-4.md',
        },
      ];

      const changes = createChangesFromProjectsVersionPlans(
        versionPlans,
        'my-project'
      );

      expect(changes).toHaveLength(0);
    });

    it('should handle multiple version plans affecting the same project', () => {
      const versionPlans: ProjectsVersionPlan[] = [
        {
          projectVersionBumps: {
            'my-project': 'patch',
          },
          message: 'Fix bug',
          commit: null,
          fileName: 'version-plan-5.md',
          createdOnMs: 123456789,
          absolutePath: '/path/to/version-plan-5.md',
          relativePath: '.nx/version-plans/version-plan-5.md',
        },
        {
          projectVersionBumps: {
            'my-project': 'minor',
            'another-project': 'patch',
          },
          message: 'Add feature',
          commit: null,
          fileName: 'version-plan-6.md',
          createdOnMs: 123456790,
          absolutePath: '/path/to/version-plan-6.md',
          relativePath: '.nx/version-plans/version-plan-6.md',
        },
      ];

      const changes = createChangesFromProjectsVersionPlans(
        versionPlans,
        'my-project'
      );

      expect(changes).toHaveLength(2);
      expect(changes[0].description).toBe('Fix bug');
      expect(changes[0].type).toBe('fix');
      expect(changes[1].description).toBe('Add feature');
      expect(changes[1].type).toBe('feat');
    });
  });
});
