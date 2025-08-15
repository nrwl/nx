import {
  getProjectsAffectedByVersionPlan,
  areAllVersionPlanProjectsFiltered,
  getVersionPlanProjectsOutsideFilter,
  validateResolvedVersionPlansAgainstFilter,
} from './version-plan-utils';
import type {
  GroupVersionPlan,
  ProjectsVersionPlan,
} from '../config/version-plans';
import type { ReleaseGroupWithName } from '../config/filter-release-groups';

describe('version-plan-utils', () => {
  let mockReleaseGroup: ReleaseGroupWithName;

  beforeEach(() => {
    mockReleaseGroup = {
      name: 'test-group',
      projects: ['project-a', 'project-b', 'project-c'],
      projectsRelationship: 'independent',
      changelog: false,
      version: {
        conventionalCommits: false,
        generator: '',
        generatorOptions: {},
        groupPreVersionCommand: '',
      },
      releaseTagPattern: '',
      releaseTagPatternCheckAllBranchesWhen: undefined,
      releaseTagPatternRequireSemver: true,
      releaseTagPatternStrictPreid: false,
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

  describe('getVersionPlanProjectsOutsideFilter', () => {
    it('should return projects in version plan that are not filtered', () => {
      const plan: ProjectsVersionPlan = {
        projectVersionBumps: {
          'project-a': 'major',
          'project-b': 'patch',
          'project-c': 'minor',
        },
        commit: undefined,
        message: undefined,
        absolutePath: undefined,
        relativePath: undefined,
        fileName: undefined,
        createdOnMs: undefined,
      };
      const filteredProjects = new Set(['project-a']); // only project-a is filtered

      const result = getVersionPlanProjectsOutsideFilter(
        plan,
        mockReleaseGroup,
        filteredProjects
      );

      expect(result.sort()).toEqual(['project-b', 'project-c']);
    });

    it('should return empty array when all version plan projects are filtered', () => {
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

      const result = getVersionPlanProjectsOutsideFilter(
        plan,
        mockReleaseGroup,
        filteredProjects
      );

      expect(result).toEqual([]);
    });

    it('should return empty array when filteredProjects is undefined', () => {
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

      const result = getVersionPlanProjectsOutsideFilter(
        plan,
        mockReleaseGroup,
        undefined
      );

      expect(result).toEqual([]);
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
      const filteredProjects = new Set(['project-a']); // only project-a is filtered

      const result = getVersionPlanProjectsOutsideFilter(
        plan,
        mockReleaseGroup,
        filteredProjects
      );

      expect(result.sort()).toEqual(['project-b', 'project-c']);
    });
  });

  describe('validateResolvedVersionPlansAgainstFilter', () => {
    it('should return null when all version plan projects are within the filter', () => {
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

      const releaseGroupWithPlan: ReleaseGroupWithName = {
        ...mockReleaseGroup,
        resolvedVersionPlans: [plan],
      };

      const releaseGroups = [releaseGroupWithPlan];
      const releaseGroupToFilteredProjects = new Map([
        [
          releaseGroupWithPlan,
          new Set(['project-a', 'project-b', 'project-c']),
        ],
      ]);

      const result = validateResolvedVersionPlansAgainstFilter(
        releaseGroups,
        releaseGroupToFilteredProjects
      );

      expect(result).toBeNull();
    });

    it('should return an error when version plan contains projects outside the filter', () => {
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

      const releaseGroupWithPlan: ReleaseGroupWithName = {
        ...mockReleaseGroup,
        resolvedVersionPlans: [plan],
      };

      const releaseGroups = [releaseGroupWithPlan];
      const releaseGroupToFilteredProjects = new Map([
        [releaseGroupWithPlan, new Set(['project-a'])], // Only project-a is filtered
      ]);

      const result = validateResolvedVersionPlansAgainstFilter(
        releaseGroups,
        releaseGroupToFilteredProjects
      );

      expect(result).toEqual({
        title:
          'Version plan contains projects not included in the release filter',
        bodyLines: [
          'The following projects in the version plan are not being released:',
          '  - project-b',
          '',
          'Either include all projects from the version plan in your release command,',
          'or create separate version plans for different sets of projects.',
        ],
      });
    });

    it('should return an error for group version plans when not all group projects are filtered', () => {
      const plan: GroupVersionPlan = {
        groupVersionBump: 'minor',
        commit: undefined,
        message: undefined,
        absolutePath: undefined,
        relativePath: undefined,
        fileName: undefined,
        createdOnMs: undefined,
      };

      const releaseGroupWithPlan: ReleaseGroupWithName = {
        ...mockReleaseGroup,
        resolvedVersionPlans: [plan],
      };

      const releaseGroups = [releaseGroupWithPlan];
      const releaseGroupToFilteredProjects = new Map([
        [releaseGroupWithPlan, new Set(['project-a', 'project-b'])], // Missing project-c
      ]);

      const result = validateResolvedVersionPlansAgainstFilter(
        releaseGroups,
        releaseGroupToFilteredProjects
      );

      expect(result).toEqual({
        title:
          'Version plan contains projects not included in the release filter',
        bodyLines: [
          'The following projects in the version plan are not being released:',
          '  - project-c',
          '',
          'Either include all projects from the version plan in your release command,',
          'or create separate version plans for different sets of projects.',
        ],
      });
    });

    it('should skip validation when resolvedVersionPlans is false', () => {
      const releaseGroupWithoutPlans: ReleaseGroupWithName = {
        ...mockReleaseGroup,
        resolvedVersionPlans: false,
      };

      const releaseGroups = [releaseGroupWithoutPlans];
      const releaseGroupToFilteredProjects = new Map([
        [releaseGroupWithoutPlans, new Set(['project-a'])],
      ]);

      const result = validateResolvedVersionPlansAgainstFilter(
        releaseGroups,
        releaseGroupToFilteredProjects
      );

      expect(result).toBeNull();
    });

    it('should skip validation when resolvedVersionPlans is empty', () => {
      const releaseGroupWithEmptyPlans: ReleaseGroupWithName = {
        ...mockReleaseGroup,
        resolvedVersionPlans: [],
      };

      const releaseGroups = [releaseGroupWithEmptyPlans];
      const releaseGroupToFilteredProjects = new Map([
        [releaseGroupWithEmptyPlans, new Set(['project-a'])],
      ]);

      const result = validateResolvedVersionPlansAgainstFilter(
        releaseGroups,
        releaseGroupToFilteredProjects
      );

      expect(result).toBeNull();
    });

    it('should check all release groups and return error for the first invalid one', () => {
      const validPlan: ProjectsVersionPlan = {
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

      const invalidPlan: ProjectsVersionPlan = {
        projectVersionBumps: {
          'project-b': 'patch',
          'project-c': 'minor',
        },
        commit: undefined,
        message: undefined,
        absolutePath: undefined,
        relativePath: undefined,
        fileName: undefined,
        createdOnMs: undefined,
      };

      const group1: ReleaseGroupWithName = {
        ...mockReleaseGroup,
        name: 'group1',
        projects: ['project-a'],
        resolvedVersionPlans: [validPlan],
      };

      const group2: ReleaseGroupWithName = {
        ...mockReleaseGroup,
        name: 'group2',
        projects: ['project-b', 'project-c'],
        resolvedVersionPlans: [invalidPlan],
      };

      const releaseGroups = [group1, group2];
      const releaseGroupToFilteredProjects = new Map([
        [group1, new Set(['project-a'])],
        [group2, new Set(['project-b'])], // Missing project-c
      ]);

      const result = validateResolvedVersionPlansAgainstFilter(
        releaseGroups,
        releaseGroupToFilteredProjects
      );

      expect(result).toEqual({
        title:
          'Version plan contains projects not included in the release filter',
        bodyLines: [
          'The following projects in the version plan are not being released:',
          '  - project-c',
          '',
          'Either include all projects from the version plan in your release command,',
          'or create separate version plans for different sets of projects.',
        ],
      });
    });
  });
});
