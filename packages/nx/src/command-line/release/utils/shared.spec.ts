import { ReleaseGroupWithName } from '../config/filter-release-groups';
import { createCommitMessageValues, createGitTagValues } from './shared';

describe('shared', () => {
  describe('createCommitMessageValues()', () => {
    describe('userCommitMessage interpolation', () => {
      it('should strip {projectName} and {version} from the main commit message if multiple release groups, and instead add all the relevant information at the end of the commit', () => {
        const releaseGroups: ReleaseGroupWithName[] = [
          {
            name: 'one',
            projectsRelationship: 'independent',
            projects: ['foo'], // single project, will get flattened in the final commit message
            version: {
              conventionalCommits: false,
              generator: '@nx/js:version',
              generatorOptions: {},
              groupPreVersionCommand: '',
            },
            changelog: false,
            releaseTagPattern: '{projectName}-{version}',
            releaseTagPatternCheckAllBranchesWhen: undefined,
            releaseTagPatternRequireSemver: true,
            releaseTagPatternStrictPreid: false,
            versionPlans: false,
            resolvedVersionPlans: false,
          },
          {
            name: 'two',
            projectsRelationship: 'fixed',
            projects: ['bar', 'baz'],
            version: {
              conventionalCommits: false,
              generator: '@nx/js:version',
              generatorOptions: {},
              groupPreVersionCommand: '',
            },
            changelog: false,
            releaseTagPattern: '{projectName}-{version}',
            releaseTagPatternCheckAllBranchesWhen: undefined,
            releaseTagPatternRequireSemver: true,
            releaseTagPatternStrictPreid: false,
            versionPlans: false,
            resolvedVersionPlans: false,
          },
        ];
        const releaseGroupToFilteredProjects = new Map()
          .set(releaseGroups[0], new Set(['foo']))
          .set(releaseGroups[1], new Set(['bar', 'baz']));
        const versionData = {
          foo: {
            currentVersion: '1.0.0',
            dependentProjects: [],
            newVersion: '1.0.1',
            dockerVersion: null,
          },
          bar: {
            currentVersion: '1.0.0',
            dependentProjects: [],
            newVersion: '1.0.1',
            dockerVersion: null,
          },
          baz: {
            currentVersion: '1.0.0',
            dependentProjects: [],
            newVersion: '1.0.1',
            dockerVersion: null,
          },
        };
        const userCommitMessage =
          'chore(release): publish {projectName} v{version}';
        const result = createCommitMessageValues(
          releaseGroups,
          releaseGroupToFilteredProjects,
          versionData,
          userCommitMessage
        );
        expect(result).toMatchInlineSnapshot(`
          [
            "chore(release): publish",
            "- project: foo 1.0.1",
            "- release-group: two 1.0.1",
          ]
        `);
      });

      it('should not add release groups to the commit message whose projects have no changes', () => {
        const releaseGroups: ReleaseGroupWithName[] = [
          {
            name: 'one',
            projectsRelationship: 'independent',
            projects: ['foo'], // single project, will get flattened in the final commit message
            version: {
              conventionalCommits: false,
              generator: '@nx/js:version',
              generatorOptions: {},
              groupPreVersionCommand: '',
            },
            changelog: false,
            releaseTagPattern: '{projectName}-{version}',
            releaseTagPatternCheckAllBranchesWhen: undefined,
            releaseTagPatternRequireSemver: true,
            releaseTagPatternStrictPreid: false,
            versionPlans: false,
            resolvedVersionPlans: false,
          },
          {
            name: 'two',
            projectsRelationship: 'fixed',
            projects: ['bar', 'baz'],
            version: {
              conventionalCommits: false,
              generator: '@nx/js:version',
              generatorOptions: {},
              groupPreVersionCommand: '',
            },
            changelog: false,
            releaseTagPattern: '{projectName}-{version}',
            releaseTagPatternCheckAllBranchesWhen: undefined,
            releaseTagPatternRequireSemver: true,
            releaseTagPatternStrictPreid: false,
            versionPlans: false,
            resolvedVersionPlans: false,
          },
        ];
        const releaseGroupToFilteredProjects = new Map()
          .set(releaseGroups[0], new Set(['foo']))
          .set(releaseGroups[1], new Set(['bar', 'baz']));
        const versionData = {
          foo: {
            currentVersion: '1.0.0',
            dependentProjects: [],
            newVersion: '1.0.1',
          },
          bar: {
            currentVersion: '1.0.0',
            dependentProjects: [],
            newVersion: null, // no changes
          },
          baz: {
            currentVersion: '1.0.0',
            dependentProjects: [],
            newVersion: null, // no changes
          },
        };
        const userCommitMessage =
          'chore(release): publish {projectName} v{version}';
        const result = createCommitMessageValues(
          releaseGroups,
          releaseGroupToFilteredProjects,
          versionData,
          userCommitMessage
        );
        expect(result).toMatchInlineSnapshot(`
          [
            "chore(release): publish",
            "- project: foo 1.0.1",
          ]
        `);
      });

      it('should interpolate the {projectName} and {version} within the main commit message if a single project within a single independent release group is being committed', () => {
        const releaseGroups: ReleaseGroupWithName[] = [
          {
            projectsRelationship: 'independent',
            projects: [
              'native-federation-typescript',
              'native-federation-tests',
              'storybook-addon',
              'typescript',
              'nextjs-mf',
              'utils',
              'enhanced',
              'core',
              'node',
            ],
            version: {
              conventionalCommits: true,
              generator: '@nx/js:release-version',
              generatorOptions: {
                specifierSource: 'conventional-commits',
                currentVersionResolver: 'git-tag',
              },
              groupPreVersionCommand: '',
            },
            changelog: {
              createRelease: 'github',
              entryWhenNoChanges:
                'This was a version bump only for {projectName} to align it with other projects, there were no code changes.',
              file: '{projectRoot}/CHANGELOG.md',
              renderer: 'custom-changelog-renderer',
              renderOptions: { authors: true },
            },
            releaseTagPattern: '{projectName}-{version}',
            releaseTagPatternCheckAllBranchesWhen: undefined,
            releaseTagPatternRequireSemver: true,
            releaseTagPatternStrictPreid: false,
            name: '__default__',
            versionPlans: false,
            resolvedVersionPlans: false,
          },
        ];

        const result = createCommitMessageValues(
          releaseGroups,
          new Map().set(releaseGroups[0], new Set(['core'])),
          {
            core: {
              currentVersion: '1.0.0-canary.1',
              dependentProjects: [
                {
                  source: 'react_ts_host',
                  target: 'core',
                  type: 'static',
                  dependencyCollection: 'devDependencies',
                  rawVersionSpec: '1.0.0-canary.1',
                },
              ],
              newVersion: '1.0.0-canary.2',
            },
          },
          'chore(release): Release {projectName} v{version} [skip ci]'
        );
        expect(result).toMatchInlineSnapshot(`
          [
            "chore(release): Release core v1.0.0-canary.2 [skip ci]",
          ]
        `);
      });

      it('should respect custom commit message for independent versioning with multiple projects', () => {
        const releaseGroups: ReleaseGroupWithName[] = [
          {
            projectsRelationship: 'independent',
            projects: ['project-a', 'project-b'],
            version: {
              conventionalCommits: false,
              generator: '@nx/js:version',
              generatorOptions: {},
              groupPreVersionCommand: '',
            },
            changelog: false,
            releaseTagPattern: '{projectName}-{version}',
            releaseTagPatternCheckAllBranchesWhen: undefined,
            releaseTagPatternRequireSemver: true,
            releaseTagPatternStrictPreid: false,
            name: '__default__',
            versionPlans: false,
            resolvedVersionPlans: false,
          },
        ];

        const customCommitMessage = 'ci: release updates [skip ci]';
        const result = createCommitMessageValues(
          releaseGroups,
          new Map().set(releaseGroups[0], new Set(['project-a', 'project-b'])),
          {
            'project-a': {
              currentVersion: '1.0.0',
              dependentProjects: [],
              newVersion: '1.0.1',
            },
            'project-b': {
              currentVersion: '2.0.0',
              dependentProjects: [],
              newVersion: '2.0.1',
            },
          },
          customCommitMessage
        );

        expect(result).toMatchInlineSnapshot(`
          [
            "ci: release updates [skip ci]",
            "- project: project-a 1.0.1",
            "- project: project-b 2.0.1",
          ]
        `);
      });

      it('should respect custom commit message with placeholders for single project in independent group', () => {
        const releaseGroups: ReleaseGroupWithName[] = [
          {
            projectsRelationship: 'independent',
            projects: ['my-lib'],
            version: {
              conventionalCommits: false,
              generator: '@nx/js:version',
              generatorOptions: {},
              groupPreVersionCommand: '',
            },
            changelog: false,
            releaseTagPattern: '{projectName}-{version}',
            releaseTagPatternCheckAllBranchesWhen: undefined,
            releaseTagPatternRequireSemver: true,
            releaseTagPatternStrictPreid: false,
            name: '__default__',
            versionPlans: false,
            resolvedVersionPlans: false,
          },
        ];

        // Custom message WITHOUT {projectName} placeholder should still be respected
        const customCommitMessage = 'build: bump version to {version}';
        const result = createCommitMessageValues(
          releaseGroups,
          new Map().set(releaseGroups[0], new Set(['my-lib'])),
          {
            'my-lib': {
              currentVersion: '3.2.1',
              dependentProjects: [],
              newVersion: '3.3.0',
            },
          },
          customCommitMessage
        );

        // Should interpolate version even without {projectName} in the message
        expect(result).toMatchInlineSnapshot(`
          [
            "build: bump version to 3.3.0",
          ]
        `);
      });

      it('should use default format when using the default commit message with multiple independent projects', () => {
        const releaseGroups: ReleaseGroupWithName[] = [
          {
            projectsRelationship: 'independent',
            projects: ['lib-a', 'lib-b'],
            version: {
              conventionalCommits: false,
              generator: '@nx/js:version',
              generatorOptions: {},
              groupPreVersionCommand: '',
            },
            changelog: false,
            releaseTagPattern: '{projectName}-{version}',
            releaseTagPatternCheckAllBranchesWhen: undefined,
            releaseTagPatternRequireSemver: true,
            releaseTagPatternStrictPreid: false,
            name: '__default__',
            versionPlans: false,
            resolvedVersionPlans: false,
          },
        ];

        // Using the default commit message
        const defaultCommitMessage = 'chore(release): publish {version}';
        const result = createCommitMessageValues(
          releaseGroups,
          new Map().set(releaseGroups[0], new Set(['lib-a', 'lib-b'])),
          {
            'lib-a': {
              currentVersion: '1.0.0',
              dependentProjects: [],
              newVersion: '1.0.1',
            },
            'lib-b': {
              currentVersion: '2.0.0',
              dependentProjects: [],
              newVersion: '2.0.1',
            },
          },
          defaultCommitMessage
        );

        // Should use the existing behavior with bullet points
        expect(result).toMatchInlineSnapshot(`
          [
            "chore(release): publish",
            "- project: lib-a 1.0.1",
            "- project: lib-b 2.0.1",
          ]
        `);
      });
    });
  });

  describe(`${createGitTagValues.name}()`, () => {
    it('should tag and interpolate the {version} if fixed group is bumping', () => {
      const { releaseGroup, releaseGroupToFilteredProjects } =
        setUpReleaseGroup();

      const tags = createGitTagValues(
        [releaseGroup],
        releaseGroupToFilteredProjects,
        {
          a: {
            currentVersion: '1.0.0',
            dependentProjects: [],
            newVersion: '1.1.0',
          },
          b: {
            currentVersion: '1.0.0',
            dependentProjects: [],
            newVersion: '1.1.0',
          },
        }
      );

      expect(tags).toEqual(['my-group-1.1.0']);
    });

    it('should not tag if fixed group is not bumping', () => {
      const { releaseGroup, releaseGroupToFilteredProjects } =
        setUpReleaseGroup();

      const tags = createGitTagValues(
        [releaseGroup],
        releaseGroupToFilteredProjects,
        {
          a: {
            currentVersion: '1.0.0',
            dependentProjects: [],
            newVersion: null,
            dockerVersion: null,
          },
          b: {
            currentVersion: '1.0.0',
            dependentProjects: [],
            newVersion: null,
            dockerVersion: null,
          },
        }
      );

      expect(tags).toEqual([]);
    });

    function setUpReleaseGroup() {
      const projects = ['a', 'b'];
      const releaseGroup: ReleaseGroupWithName = {
        name: 'my-group',
        projects,
        projectsRelationship: 'fixed',
        releaseTagPattern: 'my-group-{version}',
        releaseTagPatternCheckAllBranchesWhen: undefined,
        releaseTagPatternRequireSemver: true,
        releaseTagPatternStrictPreid: false,
        changelog: undefined,
        version: undefined,
        versionPlans: false,
        resolvedVersionPlans: false,
      };
      const releaseGroupToFilteredProjects = new Map().set(
        releaseGroup,
        new Set(projects)
      );
      return { releaseGroup, releaseGroupToFilteredProjects };
    }
  });
});
