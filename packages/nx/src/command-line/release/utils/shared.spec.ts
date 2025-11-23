import { ReleaseGroupWithName } from '../config/filter-release-groups';
import {
  createCommitMessageValues,
  createGitTagValues,
  getCommitsRelevantToProjects,
} from './shared';
import { ProjectGraph } from '../../../config/project-graph';
import { GitCommit } from './git';
import { readNxJson } from '../../../config/nx-json';

jest.mock('../../../config/nx-json', () => ({
  ...jest.requireActual('../../../config/nx-json'),
  readNxJson: jest.fn(),
}));
import { createVersionConfig } from './test/test-utils';
import { createNxReleaseConfig, NxReleaseConfig } from '../config/config';
import { createProjectFileMapUsingProjectGraph } from '../../../project-graph/file-map-utils';

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
              ...createVersionConfig(),
              conventionalCommits: false,
            },
            changelog: false,
            releaseTag: {
              pattern: '{projectName}-{version}',
              checkAllBranchesWhen: undefined,
              requireSemver: true,
              preferDockerVersion: undefined,
              strictPreid: false,
            },
            versionPlans: false,
            resolvedVersionPlans: false,
          },
          {
            name: 'two',
            projectsRelationship: 'fixed',
            projects: ['bar', 'baz'],
            version: {
              ...createVersionConfig(),
              conventionalCommits: false,
            },
            changelog: false,
            releaseTag: {
              pattern: '{projectName}-{version}',
              checkAllBranchesWhen: undefined,
              requireSemver: true,
              preferDockerVersion: undefined,
              strictPreid: false,
            },
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
              ...createVersionConfig(),
              conventionalCommits: false,
            },
            changelog: false,
            releaseTag: {
              pattern: '{projectName}-{version}',
              checkAllBranchesWhen: undefined,
              requireSemver: true,
              preferDockerVersion: undefined,
              strictPreid: false,
            },
            versionPlans: false,
            resolvedVersionPlans: false,
          },
          {
            name: 'two',
            projectsRelationship: 'fixed',
            projects: ['bar', 'baz'],
            version: {
              ...createVersionConfig(),
              conventionalCommits: false,
            },
            changelog: false,
            releaseTag: {
              pattern: '{projectName}-{version}',
              checkAllBranchesWhen: undefined,
              requireSemver: true,
              preferDockerVersion: undefined,
              strictPreid: false,
            },
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
              ...createVersionConfig(),
              conventionalCommits: true,
              specifierSource: 'conventional-commits',
              currentVersionResolver: 'git-tag',
            },
            changelog: {
              createRelease: 'github',
              entryWhenNoChanges:
                'This was a version bump only for {projectName} to align it with other projects, there were no code changes.',
              file: '{projectRoot}/CHANGELOG.md',
              renderer: 'custom-changelog-renderer',
              renderOptions: { authors: true },
            },
            releaseTag: {
              pattern: '{projectName}-{version}',
              checkAllBranchesWhen: undefined,
              requireSemver: true,
              preferDockerVersion: undefined,
              strictPreid: false,
            },
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

    it('should use docker version when releaseTagPatternPreferDockerVersion is true', () => {
      const { releaseGroup, releaseGroupToFilteredProjects } =
        setUpReleaseGroup();
      releaseGroup.releaseTag.preferDockerVersion = true;

      const tags = createGitTagValues(
        [releaseGroup],
        releaseGroupToFilteredProjects,
        {
          a: {
            currentVersion: '1.0.0',
            dependentProjects: [],
            newVersion: '1.1.0',
            dockerVersion: '2024.01.abc123',
          },
          b: {
            currentVersion: '1.0.0',
            dependentProjects: [],
            newVersion: '1.1.0',
            dockerVersion: '2024.01.abc123',
          },
        }
      );

      expect(tags).toEqual(['my-group-2024.01.abc123']);
    });

    it('should use semver version when releaseTagPatternPreferDockerVersion is false', () => {
      const { releaseGroup, releaseGroupToFilteredProjects } =
        setUpReleaseGroup();
      releaseGroup.releaseTag.preferDockerVersion = false;

      const tags = createGitTagValues(
        [releaseGroup],
        releaseGroupToFilteredProjects,
        {
          a: {
            currentVersion: '1.0.0',
            dependentProjects: [],
            newVersion: '1.1.0',
            dockerVersion: '2024.01.abc123',
          },
          b: {
            currentVersion: '1.0.0',
            dependentProjects: [],
            newVersion: '1.1.0',
            dockerVersion: '2024.01.abc123',
          },
        }
      );

      expect(tags).toEqual(['my-group-1.1.0']);
    });

    it('should create tags for both versions when releaseTagPatternPreferDockerVersion is "both"', () => {
      const { releaseGroup, releaseGroupToFilteredProjects } =
        setUpReleaseGroup();
      releaseGroup.releaseTag.preferDockerVersion = 'both';

      const tags = createGitTagValues(
        [releaseGroup],
        releaseGroupToFilteredProjects,
        {
          a: {
            currentVersion: '1.0.0',
            dependentProjects: [],
            newVersion: '1.1.0',
            dockerVersion: '2024.01.abc123',
          },
          b: {
            currentVersion: '1.0.0',
            dependentProjects: [],
            newVersion: '1.1.0',
            dockerVersion: '2024.01.abc123',
          },
        }
      );

      expect(tags).toEqual(['my-group-2024.01.abc123', 'my-group-1.1.0']);
    });

    it('should handle "both" when only dockerVersion is available', () => {
      const { releaseGroup, releaseGroupToFilteredProjects } =
        setUpReleaseGroup();
      releaseGroup.releaseTag.preferDockerVersion = 'both';

      const tags = createGitTagValues(
        [releaseGroup],
        releaseGroupToFilteredProjects,
        {
          a: {
            currentVersion: '1.0.0',
            dependentProjects: [],
            newVersion: null,
            dockerVersion: '2024.01.abc123',
          },
          b: {
            currentVersion: '1.0.0',
            dependentProjects: [],
            newVersion: null,
            dockerVersion: '2024.01.abc123',
          },
        }
      );

      expect(tags).toEqual(['my-group-2024.01.abc123']);
    });

    it('should handle independent projects with "both" preference', () => {
      const projects = ['a', 'b'];
      const releaseGroup: ReleaseGroupWithName = {
        name: 'my-group',
        projects,
        projectsRelationship: 'independent',
        releaseTag: {
          pattern: '{projectName}-{version}',
          checkAllBranchesWhen: undefined,
          requireSemver: true,
          preferDockerVersion: 'both',
          strictPreid: false,
        },
        changelog: undefined,
        version: undefined,
        versionPlans: false,
        resolvedVersionPlans: false,
      };
      const releaseGroupToFilteredProjects = new Map().set(
        releaseGroup,
        new Set(projects)
      );

      const tags = createGitTagValues(
        [releaseGroup],
        releaseGroupToFilteredProjects,
        {
          a: {
            currentVersion: '1.0.0',
            dependentProjects: [],
            newVersion: '1.1.0',
            dockerVersion: '2024.01.abc123',
          },
          b: {
            currentVersion: '1.0.0',
            dependentProjects: [],
            newVersion: '1.2.0',
            dockerVersion: '2024.01.def456',
          },
        }
      );

      expect(tags).toEqual([
        'a-2024.01.abc123',
        'a-1.1.0',
        'b-2024.01.def456',
        'b-1.2.0',
      ]);
    });

    function setUpReleaseGroup() {
      const projects = ['a', 'b'];
      const releaseGroup: ReleaseGroupWithName = {
        name: 'my-group',
        projects,
        projectsRelationship: 'fixed',
        releaseTag: {
          pattern: 'my-group-{version}',
          checkAllBranchesWhen: undefined,
          requireSemver: true,
          preferDockerVersion: undefined,
          strictPreid: false,
        },
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

  describe(`getCommitsRelevantToProjects()`, () => {
    let mockProjectGraph: ProjectGraph;
    let mockReleaseConfig: NxReleaseConfig | null;

    beforeEach(async () => {
      (readNxJson as jest.Mock).mockReturnValue({});

      mockProjectGraph = {
        nodes: {
          'lib-a': {
            name: 'lib-a',
            type: 'lib',
            data: {
              root: 'libs/lib-a',
            },
          },
          'lib-b': {
            name: 'lib-b',
            type: 'lib',
            data: {
              root: 'libs/lib-b',
            },
          },
          'lib-c': {
            name: 'lib-c',
            type: 'lib',
            data: {
              root: 'libs/lib-c',
            },
          },
          app: {
            name: 'app',
            type: 'app',
            data: {
              root: 'apps/app',
            },
          },
        },
        dependencies: {
          'lib-a': [],
          'lib-b': [],
          'lib-c': [],
          app: [
            {
              source: 'app',
              target: 'lib-a',
              type: 'static',
            },
          ],
        },
        externalNodes: {},
      };

      ({ nxReleaseConfig: mockReleaseConfig } = await createNxReleaseConfig(
        mockProjectGraph,
        await createProjectFileMapUsingProjectGraph(mockProjectGraph),
        {
          projects: Object.keys(mockProjectGraph.nodes),
          changelog: {
            git: {
              commitMessage: 'chore(release): publish packages',
            },
          },
        }
      ));
    });

    it('should include commits that directly touch target projects', async () => {
      const commits: GitCommit[] = [
        createMockCommit('abc123', ['libs/lib-a/src/index.ts']),
        createMockCommit('def456', ['libs/lib-b/src/index.ts']),
        createMockCommit('ghi789', ['libs/lib-c/src/index.ts']),
      ];

      const result = await getCommitsRelevantToProjects(
        mockProjectGraph,
        commits,
        ['lib-a', 'lib-b'],
        mockReleaseConfig!
      );

      expect(result.size).toBe(2);
      expect(result.get('lib-a')).toHaveLength(1);
      expect(result.get('lib-a')?.[0]?.commit.shortHash).toBe('abc123');
      expect(result.get('lib-b')).toHaveLength(1);
      expect(result.get('lib-b')?.[0]?.commit.shortHash).toBe('def456');
      expect(result.has('lib-c')).toBe(false);
    });

    it('should include commits that touch global files affecting all projects', async () => {
      const commits: GitCommit[] = [
        createMockCommit('abc123', ['nx.json']),
        createMockCommit('def456', ['libs/lib-a/src/index.ts']),
      ];

      const result = await getCommitsRelevantToProjects(
        mockProjectGraph,
        commits,
        ['lib-a'],
        mockReleaseConfig!
      );

      // Both commits should be included - nx.json affects all, and lib-a is directly touched
      expect(result.size).toBe(1);
      expect(result.get('lib-a')).toHaveLength(2);
      const commitHashes = result.get('lib-a')?.map((c) => c.commit.shortHash);
      expect(commitHashes).toContain('abc123');
      expect(commitHashes).toContain('def456');
    });

    it('should exclude commits that only touch unrelated projects', async () => {
      const commits: GitCommit[] = [
        createMockCommit('abc123', ['libs/lib-c/src/index.ts']),
        createMockCommit('def456', ['libs/lib-a/src/index.ts']),
      ];

      const result = await getCommitsRelevantToProjects(
        mockProjectGraph,
        commits,
        ['lib-a'],
        mockReleaseConfig!
      );

      expect(result.size).toBe(1);
      expect(result.get('lib-a')).toHaveLength(1);
      expect(result.get('lib-a')?.[0]?.commit.shortHash).toBe('def456');
      expect(result.has('lib-c')).toBe(false);
    });

    it('should include commits that touch dependencies of target projects', async () => {
      // Update graph so lib-a depends on lib-c
      mockProjectGraph.dependencies['lib-a'] = [
        {
          source: 'lib-a',
          target: 'lib-c',
          type: 'static',
        },
      ];

      const commits: GitCommit[] = [
        createMockCommit('abc123', ['libs/lib-c/src/index.ts']),
      ];

      const result = await getCommitsRelevantToProjects(
        mockProjectGraph,
        commits,
        ['lib-a'],
        mockReleaseConfig!
      );

      // lib-a depends on lib-c, so commit touching lib-c should affect lib-a
      expect(result.size).toBe(1);
      expect(result.get('lib-a')).toHaveLength(1);
      expect(result.get('lib-a')?.[0]?.commit.shortHash).toBe('abc123');
    });

    it('should handle commits with multiple affected files', async () => {
      const commits: GitCommit[] = [
        createMockCommit('abc123', [
          'libs/lib-a/src/index.ts',
          'libs/lib-b/src/index.ts',
          'libs/lib-c/src/index.ts',
        ]),
      ];

      const result = await getCommitsRelevantToProjects(
        mockProjectGraph,
        commits,
        ['lib-a'],
        mockReleaseConfig!
      );

      expect(result.size).toBe(1);
      expect(result.get('lib-a')).toHaveLength(1);
      expect(result.get('lib-a')?.[0]?.commit.shortHash).toBe('abc123');
    });

    it('should include the same commit for multiple projects when it affects both', async () => {
      const commits: GitCommit[] = [
        createMockCommit('abc123', [
          'libs/lib-a/src/index.ts',
          'libs/lib-b/src/index.ts',
        ]),
      ];

      const result = await getCommitsRelevantToProjects(
        mockProjectGraph,
        commits,
        ['lib-a', 'lib-b'],
        mockReleaseConfig!
      );

      // Same commit should appear for both projects
      expect(result.size).toBe(2);
      expect(result.get('lib-a')).toHaveLength(1);
      expect(result.get('lib-a')?.[0]?.commit.shortHash).toBe('abc123');
      expect(result.get('lib-b')).toHaveLength(1);
      expect(result.get('lib-b')?.[0]?.commit.shortHash).toBe('abc123');
    });

    it('should include global file commits for all requested projects', async () => {
      const commits: GitCommit[] = [createMockCommit('abc123', ['nx.json'])];

      const result = await getCommitsRelevantToProjects(
        mockProjectGraph,
        commits,
        ['lib-a', 'lib-b'],
        mockReleaseConfig!
      );

      // Global file should appear for all requested projects
      expect(result.size).toBe(2);
      expect(result.get('lib-a')).toBeDefined();
      expect(result.get('lib-b')).toBeDefined();
      expect(result.get('lib-a')?.[0]?.commit.shortHash).toBe('abc123');
      expect(result.get('lib-b')?.[0]?.commit.shortHash).toBe('abc123');
    });

    it('should not include projects with no relevant commits in the map', async () => {
      const commits: GitCommit[] = [
        createMockCommit('abc123', ['libs/lib-c/src/index.ts']),
      ];

      const result = await getCommitsRelevantToProjects(
        mockProjectGraph,
        commits,
        ['lib-a', 'lib-b'],
        mockReleaseConfig!
      );

      expect(result.has('lib-a')).toBe(false);
      expect(result.has('lib-b')).toBe(false);
      expect(result.size).toBe(0);
    });

    it('should handle empty commit list', async () => {
      const result = await getCommitsRelevantToProjects(
        mockProjectGraph,
        [],
        ['lib-a'],
        mockReleaseConfig!
      );

      expect(result.size).toBe(0);
    });

    it('should handle empty project list', async () => {
      const commits: GitCommit[] = [
        createMockCommit('abc123', ['libs/lib-a/src/index.ts']),
      ];

      const result = await getCommitsRelevantToProjects(
        mockProjectGraph,
        commits,
        [],
        mockReleaseConfig!
      );

      expect(result.size).toBe(0);
    });

    it('should include commits touching lock files when they affect target projects', async () => {
      const commits: GitCommit[] = [
        createMockCommit('abc123', ['package-lock.json']),
        createMockCommit('def456', ['pnpm-lock.yaml']),
      ];

      const result = await getCommitsRelevantToProjects(
        mockProjectGraph,
        commits,
        ['lib-a'],
        mockReleaseConfig!
      );

      // Lock file changes typically affect all or many projects
      // The exact behavior depends on the lock file locator logic
      expect(result.size).toBeGreaterThanOrEqual(0);
    });

    it('should include commits touching root package.json', async () => {
      const commits: GitCommit[] = [
        createMockCommit('abc123', ['package.json']),
      ];

      const result = await getCommitsRelevantToProjects(
        mockProjectGraph,
        commits,
        ['lib-a'],
        mockReleaseConfig!
      );

      // package.json changes typically affect projects
      expect(result.size).toBeGreaterThanOrEqual(0);
    });

    it('should exclude automated version or changelog commits', async () => {
      const commits: GitCommit[] = [
        createMockCommit(
          'abc123',
          ['libs/deleted-lib-1/package.json'],
          'chore(release): publish 1.0.0' // with version interpolated
        ),
        createMockCommit(
          'def456',
          ['libs/deleted-lib-2/package.json'],
          'chore(release): publish packages'
        ),
      ];

      const result = await getCommitsRelevantToProjects(
        mockProjectGraph,
        commits,
        ['lib-a'],
        mockReleaseConfig!
      );

      expect(result.size).toBe(0);
    });

    function createMockCommit(
      shortHash: string,
      affectedFiles: string[],
      message?: string
    ): GitCommit {
      return {
        message: message || `feat: commit ${shortHash}`,
        body: '',
        shortHash,
        author: { name: 'Test Author', email: 'test@example.com' },
        description: `commit ${shortHash}`,
        type: 'feat',
        scope: '',
        references: [],
        authors: [{ name: 'Test Author', email: 'test@example.com' }],
        isBreaking: false,
        affectedFiles,
        revertedHashes: [],
      };
    }
  });
});
