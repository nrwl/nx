import { ReleaseGroupWithName } from '../config/filter-release-groups';
import { createCommitMessageValues } from './shared';

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
            },
            changelog: false,
            releaseTagPattern: '{projectName}-{version}',
          },
          {
            name: 'two',
            projectsRelationship: 'fixed',
            projects: ['bar', 'baz'],
            version: {
              conventionalCommits: false,
              generator: '@nx/js:version',
              generatorOptions: {},
            },
            changelog: false,
            releaseTagPattern: '{projectName}-{version}',
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
            newVersion: '1.0.1',
          },
          baz: {
            currentVersion: '1.0.0',
            dependentProjects: [],
            newVersion: '1.0.1',
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
            },
            changelog: {
              createRelease: 'github',
              entryWhenNoChanges:
                'This was a version bump only for {projectName} to align it with other projects, there were no code changes.',
              file: '{projectRoot}/CHANGELOG.md',
              renderer: 'nx/release/changelog-renderer',
              renderOptions: { authors: true },
            },
            releaseTagPattern: '{projectName}-{version}',
            name: '__default__',
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
    });
  });
});
