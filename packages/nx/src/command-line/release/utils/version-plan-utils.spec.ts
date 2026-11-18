import {
  getProjectsAffectedByVersionPlan,
  areAllVersionPlanProjectsFiltered,
  validateResolvedVersionPlansAgainstFilter,
} from './version-plan-utils';
import type {
  GroupVersionPlan,
  ProjectsVersionPlan,
} from '../config/version-plans';
import type { ReleaseGroupWithName } from '../config/filter-release-groups';
import { createVersionConfig } from './test/test-utils';

describe('version-plan-utils', () => {
  let mockReleaseGroup: ReleaseGroupWithName;

  beforeEach(() => {
    mockReleaseGroup = {
      name: 'test-group',
      projects: ['project-a', 'project-b', 'project-c'],
      projectsRelationship: 'independent',
      changelog: false,
      version: createVersionConfig(),
      releaseTag: {
        pattern: '',
        checkAllBranchesWhen: undefined,
        requireSemver: true,
        strictPreid: false,
        preferDockerVersion: undefined,
      },
      versionPlans: true,
      resolvedVersionPlans: false,
    };
  });

  describe('getProjectsAffectedByVersionPlan', () => {
    it('should return all projects in group for group version bump', () => {
      const plan: GroupVersionPlan = {
        groupVersionBump: 'minor',
        commit: undefined,
        message: undefined,
        absolutePath: undefined,
        relativePath: undefined,
        fileName: undefined,
        createdOnMs: undefined,
      };

      const result = getProjectsAffectedByVersionPlan(plan, mockReleaseGroup);

      expect(result).toEqual(new Set(['project-a', 'project-b', 'project-c']));
    });

    it('should return specific projects for project version bumps', () => {
      const plan: ProjectsVersionPlan = {
        projectVersionBumps: {
          'project-a': 'major',
          'project-c': 'patch',
        },
        commit: undefined,
        message: undefined,
        absolutePath: undefined,
        relativePath: undefined,
        fileName: undefined,
        createdOnMs: undefined,
      };

      const result = getProjectsAffectedByVersionPlan(plan, mockReleaseGroup);

      expect(result).toEqual(new Set(['project-a', 'project-c']));
    });

    it('should return empty set for version plan without bumps', () => {
      const plan = {} as any;

      const result = getProjectsAffectedByVersionPlan(plan, mockReleaseGroup);

      expect(result).toEqual(new Set());
    });
  });

  describe('areAllVersionPlanProjectsFiltered', () => {
    it('should return true when all version plan projects are filtered', () => {
      const plan: ProjectsVersionPlan = {
        projectVersionBumps: {
          'project-a': 'major',
          'project-b': 'patch',
        },
        commit: undefined,
        message: undefined,
        absolutePath: undefined,
        relativePath: undefined,
        fileName: undefined,
        createdOnMs: undefined,
      };
      const filteredProjects = new Set(['project-a', 'project-b', 'project-c']);

      const result = areAllVersionPlanProjectsFiltered(
        plan,
        mockReleaseGroup,
        filteredProjects
      );

      expect(result).toBe(true);
    });

    it('should return false when some version plan projects are not filtered', () => {
      const plan: ProjectsVersionPlan = {
        projectVersionBumps: {
          'project-a': 'major',
          'project-b': 'patch',
        },
        commit: undefined,
        message: undefined,
        absolutePath: undefined,
        relativePath: undefined,
        fileName: undefined,
        createdOnMs: undefined,
      };
      const filteredProjects = new Set(['project-a']); // project-b is not filtered

      const result = areAllVersionPlanProjectsFiltered(
        plan,
        mockReleaseGroup,
        filteredProjects
      );

      expect(result).toBe(false);
    });

    it('should return false when filteredProjects is undefined', () => {
      const plan: ProjectsVersionPlan = {
        projectVersionBumps: {
          'project-a': 'major',
        },
        commit: undefined,
        message: undefined,
        absolutePath: undefined,
        relativePath: undefined,
        fileName: undefined,
        createdOnMs: undefined,
      };

      const result = areAllVersionPlanProjectsFiltered(
        plan,
        mockReleaseGroup,
        undefined
      );

      expect(result).toBe(false);
    });

    it('should return false when version plan affects no projects', () => {
      const plan = {} as any; // Empty plan
      const filteredProjects = new Set(['project-a']);

      const result = areAllVersionPlanProjectsFiltered(
        plan,
        mockReleaseGroup,
        filteredProjects
      );

      expect(result).toBe(false);
    });

    it('should handle group version plans correctly', () => {
      const plan: GroupVersionPlan = {
        groupVersionBump: 'minor',
        commit: undefined,
        message: undefined,
        absolutePath: undefined,
        relativePath: undefined,
        fileName: undefined,
        createdOnMs: undefined,
      };
      const filteredProjects = new Set(['project-a', 'project-b', 'project-c']);

      const result = areAllVersionPlanProjectsFiltered(
        plan,
        mockReleaseGroup,
        filteredProjects
      );

      expect(result).toBe(true);
    });

    it('should return false for group version plans when not all group projects are filtered', () => {
      const plan: GroupVersionPlan = {
        groupVersionBump: 'minor',
        commit: undefined,
        message: undefined,
        absolutePath: undefined,
        relativePath: undefined,
        fileName: undefined,
        createdOnMs: undefined,
      };
      const filteredProjects = new Set(['project-a', 'project-b']); // missing project-c

      const result = areAllVersionPlanProjectsFiltered(
        plan,
        mockReleaseGroup,
        filteredProjects
      );

      expect(result).toBe(false);
    });
  });

  describe('validateResolvedVersionPlansAgainstFilter', () => {
    const projectsPlan = (
      fileName: string,
      projectVersionBumps: ProjectsVersionPlan['projectVersionBumps']
    ): ProjectsVersionPlan => ({
      projectVersionBumps,
      commit: undefined,
      message: undefined,
      absolutePath: undefined,
      relativePath: undefined,
      fileName,
      createdOnMs: undefined,
    });

    const filterError = (fileName: string, projects: string[]) => ({
      title:
        'Version plan contains projects not included in the release filter',
      bodyLines: [
        `The following projects in version plan '${fileName}' are not being released:`,
        ...projects.map((p) => `  - ${p}`),
        '',
        'Either include all projects from the version plan in your release command,',
        'or create separate version plans for different sets of projects.',
      ],
    });

    it('should return null when all version plan projects are within the filter', () => {
      const releaseGroupWithPlan: ReleaseGroupWithName = {
        ...mockReleaseGroup,
        resolvedVersionPlans: [
          projectsPlan('plan.md', {
            'project-a': 'major',
            'project-b': 'patch',
          }),
        ],
      };

      const result = validateResolvedVersionPlansAgainstFilter(
        [releaseGroupWithPlan],
        new Map([
          [
            releaseGroupWithPlan,
            new Set(['project-a', 'project-b', 'project-c']),
          ],
        ])
      );

      expect(result).toBeNull();
    });

    it('should return an error when version plan contains projects outside the filter', () => {
      const releaseGroupWithPlan: ReleaseGroupWithName = {
        ...mockReleaseGroup,
        resolvedVersionPlans: [
          projectsPlan('plan.md', {
            'project-a': 'major',
            'project-b': 'patch',
          }),
        ],
      };

      const result = validateResolvedVersionPlansAgainstFilter(
        [releaseGroupWithPlan],
        new Map([[releaseGroupWithPlan, new Set(['project-a'])]])
      );

      expect(result).toEqual(filterError('plan.md', ['project-b']));
    });

    it('should return an error for group version plans when not all group projects are filtered', () => {
      const plan: GroupVersionPlan = {
        groupVersionBump: 'minor',
        commit: undefined,
        message: undefined,
        absolutePath: undefined,
        relativePath: undefined,
        fileName: 'plan.md',
        createdOnMs: undefined,
      };

      const releaseGroupWithPlan: ReleaseGroupWithName = {
        ...mockReleaseGroup,
        resolvedVersionPlans: [plan],
      };

      const result = validateResolvedVersionPlansAgainstFilter(
        [releaseGroupWithPlan],
        new Map([[releaseGroupWithPlan, new Set(['project-a', 'project-b'])]])
      );

      expect(result).toEqual(filterError('plan.md', ['project-c']));
    });

    it('should skip validation when resolvedVersionPlans is false', () => {
      const releaseGroupWithoutPlans: ReleaseGroupWithName = {
        ...mockReleaseGroup,
        resolvedVersionPlans: false,
      };

      const result = validateResolvedVersionPlansAgainstFilter(
        [releaseGroupWithoutPlans],
        new Map([[releaseGroupWithoutPlans, new Set(['project-a'])]])
      );

      expect(result).toBeNull();
    });

    it('should skip validation when resolvedVersionPlans is empty', () => {
      const releaseGroupWithEmptyPlans: ReleaseGroupWithName = {
        ...mockReleaseGroup,
        resolvedVersionPlans: [],
      };

      const result = validateResolvedVersionPlansAgainstFilter(
        [releaseGroupWithEmptyPlans],
        new Map([[releaseGroupWithEmptyPlans, new Set(['project-a'])]])
      );

      expect(result).toBeNull();
    });

    it('should check all release groups and return error for the first invalid one', () => {
      const group1: ReleaseGroupWithName = {
        ...mockReleaseGroup,
        name: 'group1',
        projects: ['project-a'],
        resolvedVersionPlans: [
          projectsPlan('valid.md', { 'project-a': 'major' }),
        ],
      };

      const group2: ReleaseGroupWithName = {
        ...mockReleaseGroup,
        name: 'group2',
        projects: ['project-b', 'project-c'],
        resolvedVersionPlans: [
          projectsPlan('invalid.md', {
            'project-b': 'patch',
            'project-c': 'minor',
          }),
        ],
      };

      const result = validateResolvedVersionPlansAgainstFilter(
        [group1, group2],
        new Map([
          [group1, new Set(['project-a'])],
          [group2, new Set(['project-b'])],
        ])
      );

      expect(result).toEqual(filterError('invalid.md', ['project-c']));
    });

    it('should return null for version plans that only target release groups outside the filter', () => {
      const filteredGroup: ReleaseGroupWithName = {
        ...mockReleaseGroup,
        name: 'group-a',
        projects: ['project-a'],
        resolvedVersionPlans: [projectsPlan('a.md', { 'project-a': 'patch' })],
      };
      const unfilteredGroup: ReleaseGroupWithName = {
        ...mockReleaseGroup,
        name: 'group-b',
        projects: ['project-b'],
        resolvedVersionPlans: [projectsPlan('b.md', { 'project-b': 'minor' })],
      };

      const result = validateResolvedVersionPlansAgainstFilter(
        [filteredGroup, unfilteredGroup],
        new Map([[filteredGroup, new Set(['project-a'])]])
      );

      expect(result).toBeNull();
    });

    it('should return an error when a version plan spans a filtered and an unfiltered release group', () => {
      const filteredGroup: ReleaseGroupWithName = {
        ...mockReleaseGroup,
        name: 'group-a',
        projects: ['project-a'],
        resolvedVersionPlans: [
          projectsPlan('shared.md', { 'project-a': 'patch' }),
        ],
      };
      const unfilteredGroup: ReleaseGroupWithName = {
        ...mockReleaseGroup,
        name: 'group-b',
        projects: ['project-b'],
        resolvedVersionPlans: [
          projectsPlan('shared.md', { 'project-b': 'minor' }),
        ],
      };

      const result = validateResolvedVersionPlansAgainstFilter(
        [filteredGroup, unfilteredGroup],
        new Map([[filteredGroup, new Set(['project-a'])]])
      );

      expect(result).toEqual(filterError('shared.md', ['project-b']));
    });
  });
});
