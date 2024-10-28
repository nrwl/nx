import type { ChangelogChange } from '../../src/command-line/release/changelog';
import { DEFAULT_CONVENTIONAL_COMMITS_CONFIG } from '../../src/command-line/release/config/conventional-commits';
import DefaultChangelogRenderer from './index';

jest.mock('../../src/project-graph/file-map-utils', () => ({
  createFileMapUsingProjectGraph: jest.fn().mockImplementation(() => {
    return Promise.resolve({
      allWorkspaceFiles: [],
      fileMap: {
        nonProjectFiles: [],
        projectFileMap: {
          'pkg-a': [
            {
              file: 'packages/pkg-a/src/index.ts',
            },
          ],
          'pkg-b': [
            {
              file: 'packages/pkg-b/src/index.ts',
            },
          ],
        },
      },
    });
  }),
}));

describe('ChangelogRenderer', () => {
  const changes: ChangelogChange[] = [
    {
      shortHash: '4130f65',
      authors: [
        {
          name: 'James Henry',
          email: 'jh@example.com',
        },
      ],
      body: '"\n\nM\tpackages/pkg-a/src/index.ts\nM\tpackages/pkg-b/src/index.ts\n"',
      description: 'all packages fixed',
      type: 'fix',
      scope: '',
      githubReferences: [
        {
          value: '4130f65',
          type: 'hash',
        },
      ],
      isBreaking: false,
      revertedHashes: [],
      affectedProjects: ['pkg-a', 'pkg-b'],
    },
    {
      shortHash: '7dc5ec3',
      authors: [
        {
          name: 'James Henry',
          email: 'jh@example.com',
        },
      ],
      body: '"\n\nM\tpackages/pkg-b/src/index.ts\n"',
      description: 'and another new capability',
      type: 'feat',
      scope: 'pkg-b',
      githubReferences: [
        {
          value: '7dc5ec3',
          type: 'hash',
        },
      ],
      isBreaking: false,
      revertedHashes: [],
      affectedProjects: ['pkg-b'],
    },
    {
      shortHash: 'd7a58a2',
      authors: [
        {
          name: 'James Henry',
          email: 'jh@example.com',
        },
      ],
      body: '"\n\nM\tpackages/pkg-a/src/index.ts\n"',
      description: 'new hotness',
      type: 'feat',
      scope: 'pkg-a',
      githubReferences: [
        {
          value: 'd7a58a2',
          type: 'hash',
        },
      ],
      isBreaking: false,
      revertedHashes: [],
      affectedProjects: ['pkg-a'],
    },
    {
      shortHash: 'feace4a',
      authors: [
        {
          name: 'James Henry',
          email: 'jh@example.com',
        },
      ],
      body: '"\n\nM\tpackages/pkg-b/src/index.ts\n"',
      description: 'brand new thing',
      type: 'feat',
      scope: 'pkg-b',
      githubReferences: [
        {
          value: 'feace4a',
          type: 'hash',
        },
      ],
      isBreaking: false,
      revertedHashes: [],
      affectedProjects: ['pkg-b'],
    },
    {
      shortHash: '6301405',
      authors: [
        {
          name: 'James Henry',
          email: 'jh@example.com',
        },
      ],
      body: '"\n\nM\tpackages/pkg-a/src/index.ts\n',
      description: 'squashing bugs',
      type: 'fix',
      scope: 'pkg-a',
      githubReferences: [
        {
          value: '6301405',
          type: 'hash',
        },
      ],
      isBreaking: false,
      revertedHashes: [],
      affectedProjects: ['pkg-a'],
    },
  ];

  describe('DefaultChangelogRenderer', () => {
    describe('workspaceChangelog', () => {
      it('should generate markdown for all projects by organizing commits by type, then grouped by scope within the type (sorted alphabetically), then chronologically within the scope group', async () => {
        const renderer = new DefaultChangelogRenderer({
          changes,
          changelogEntryVersion: 'v1.1.0',
          project: null,
          isVersionPlans: false,
          entryWhenNoChanges: false,
          changelogRenderOptions: {
            authors: true,
          },
          conventionalCommitsConfig: DEFAULT_CONVENTIONAL_COMMITS_CONFIG,
        });
        const markdown = await renderer.render();
        expect(markdown).toMatchInlineSnapshot(`
                  "## v1.1.0

                  ### 🚀 Features

                  - **pkg-a:** new hotness
                  - **pkg-b:** brand new thing
                  - **pkg-b:** and another new capability

                  ### 🩹 Fixes

                  - all packages fixed
                  - **pkg-a:** squashing bugs

                  ### ❤️  Thank You

                  - James Henry"
              `);
      });

      it('should not generate a Thank You section when changelogRenderOptions.authors is false', async () => {
        const renderer = new DefaultChangelogRenderer({
          changes,
          // Major version, should use single # for generated heading
          changelogEntryVersion: 'v1.0.0',
          project: null,
          isVersionPlans: false,
          entryWhenNoChanges: false,
          changelogRenderOptions: {
            authors: false,
          },
          conventionalCommitsConfig: DEFAULT_CONVENTIONAL_COMMITS_CONFIG,
        });
        const markdown = await renderer.render();
        expect(markdown).toMatchInlineSnapshot(`
                  "# v1.0.0

                  ### 🚀 Features

                  - **pkg-a:** new hotness
                  - **pkg-b:** brand new thing
                  - **pkg-b:** and another new capability

                  ### 🩹 Fixes

                  - all packages fixed
                  - **pkg-a:** squashing bugs"
              `);
      });
    });

    describe('project level configs', () => {
      it('should generate markdown for the given project by organizing commits by type, then chronologically', async () => {
        const otherOpts = {
          changes,
          changelogEntryVersion: 'v1.1.0',
          entryWhenNoChanges: false as const,
          isVersionPlans: false,
          changelogRenderOptions: {
            authors: true,
          },
          conventionalCommitsConfig: DEFAULT_CONVENTIONAL_COMMITS_CONFIG,
        };

        expect(
          await new DefaultChangelogRenderer({
            ...otherOpts,
            project: 'pkg-a',
          }).render()
        ).toMatchInlineSnapshot(`
                  "## v1.1.0

                  ### 🚀 Features

                  - **pkg-a:** new hotness

                  ### 🩹 Fixes

                  - all packages fixed
                  - **pkg-a:** squashing bugs

                  ### ❤️  Thank You

                  - James Henry"
              `);

        expect(
          await new DefaultChangelogRenderer({
            ...otherOpts,
            project: 'pkg-a',
            // test that the authors option is being respected for project changelogs and therefore no Thank You section exists
            changelogRenderOptions: {
              authors: false,
            },
          }).render()
        ).toMatchInlineSnapshot(`
                  "## v1.1.0

                  ### 🚀 Features

                  - **pkg-a:** new hotness

                  ### 🩹 Fixes

                  - all packages fixed
                  - **pkg-a:** squashing bugs"
              `);

        expect(
          await new DefaultChangelogRenderer({
            ...otherOpts,
            project: 'pkg-b',
          }).render()
        ).toMatchInlineSnapshot(`
                  "## v1.1.0

                  ### 🚀 Features

                  - **pkg-b:** and another new capability
                  - **pkg-b:** brand new thing

                  ### 🩹 Fixes

                  - all packages fixed

                  ### ❤️  Thank You

                  - James Henry"
              `);
      });

      it('should only include authors relevant to the specific project', async () => {
        const changes: ChangelogChange[] = [
          {
            shortHash: '4130f65',
            authors: [
              {
                name: 'Author 1',
                email: 'author-1@example.com',
              },
            ],
            body: '"\n\nM\tpackages/pkg-a/src/index.ts\nM\tpackages/pkg-b/src/index.ts\n"',
            description: 'all packages fixed',
            type: 'fix',
            scope: '',
            githubReferences: [
              {
                value: '4130f65',
                type: 'hash',
              },
            ],
            isBreaking: false,
            revertedHashes: [],
            affectedProjects: ['pkg-a', 'pkg-b'],
          },
          {
            shortHash: '7dc5ec3',
            authors: [
              {
                name: 'Author 2',
                email: 'author-2@example.com',
              },
            ],
            body: '"\n\nM\tpackages/pkg-b/src/index.ts\n"',
            description: 'and another new capability',
            type: 'feat',
            scope: 'pkg-b',
            githubReferences: [
              {
                value: '7dc5ec3',
                type: 'hash',
              },
            ],
            isBreaking: false,
            revertedHashes: [],
            affectedProjects: ['pkg-b'],
          },
          {
            shortHash: 'd7a58a2',
            authors: [
              {
                name: 'Author 3',
                email: 'author-3@example.com',
              },
            ],
            body: '"\n\nM\tpackages/pkg-a/src/index.ts\n"',
            description: 'new hotness',
            type: 'feat',
            scope: 'pkg-a',
            githubReferences: [
              {
                value: 'd7a58a2',
                type: 'hash',
              },
            ],
            isBreaking: false,
            revertedHashes: [],
            affectedProjects: ['pkg-a'],
          },
          {
            shortHash: 'feace4a',
            authors: [
              {
                name: 'Author 4',
                email: 'author-4@example.com',
              },
            ],
            body: '"\n\nM\tpackages/pkg-b/src/index.ts\n"',
            description: 'brand new thing',
            type: 'feat',
            scope: 'pkg-b',
            githubReferences: [
              {
                value: 'feace4a',
                type: 'hash',
              },
            ],
            isBreaking: false,
            revertedHashes: [],
            affectedProjects: ['pkg-b'],
          },
          {
            shortHash: '6301405',
            authors: [
              {
                name: 'Author 5',
                email: 'author-5@example.com',
              },
            ],
            body: '"\n\nM\tpackages/pkg-a/src/index.ts\n',
            description: 'squashing bugs',
            type: 'fix',
            scope: 'pkg-a',
            githubReferences: [
              {
                value: '6301405',
                type: 'hash',
              },
            ],
            isBreaking: false,
            revertedHashes: [],
            affectedProjects: ['pkg-a'],
          },
        ];

        const otherOpts = {
          changes,
          changelogEntryVersion: 'v1.1.0',
          entryWhenNoChanges: false as const,
          isVersionPlans: false,
          changelogRenderOptions: {
            authors: true,
          },
          conventionalCommitsConfig: DEFAULT_CONVENTIONAL_COMMITS_CONFIG,
        };

        expect(
          await new DefaultChangelogRenderer({
            ...otherOpts,
            project: 'pkg-a',
          }).render()
        ).toMatchInlineSnapshot(`
                  "## v1.1.0

                  ### 🚀 Features

                  - **pkg-a:** new hotness

                  ### 🩹 Fixes

                  - all packages fixed
                  - **pkg-a:** squashing bugs

                  ### ❤️  Thank You

                  - Author 1
                  - Author 3
                  - Author 5"
              `);

        expect(
          await new DefaultChangelogRenderer({
            ...otherOpts,
            project: 'pkg-b',
          }).render()
        ).toMatchInlineSnapshot(`
                  "## v1.1.0

                  ### 🚀 Features

                  - **pkg-b:** and another new capability
                  - **pkg-b:** brand new thing

                  ### 🩹 Fixes

                  - all packages fixed

                  ### ❤️  Thank You

                  - Author 1
                  - Author 2
                  - Author 4"
              `);
      });
    });

    describe('entryWhenNoChanges', () => {
      it('should respect the entryWhenNoChanges option for the workspace changelog', async () => {
        const otherOpts = {
          changes: [],
          changelogEntryVersion: 'v1.1.0',
          project: null, // workspace changelog
          isVersionPlans: false,
          changelogRenderOptions: {
            authors: true,
          },
          conventionalCommitsConfig: DEFAULT_CONVENTIONAL_COMMITS_CONFIG,
        };

        expect(
          await new DefaultChangelogRenderer({
            ...otherOpts,
            entryWhenNoChanges: 'Nothing at all!',
          }).render()
        ).toMatchInlineSnapshot(`
                  "## v1.1.0

                  Nothing at all!"
              `);

        expect(
          await new DefaultChangelogRenderer({
            ...otherOpts,
            entryWhenNoChanges: false, // should not create an entry
          }).render()
        ).toMatchInlineSnapshot(`""`);
      });

      it('should respect the entryWhenNoChanges option for project changelogs', async () => {
        const otherOpts = {
          changes: [],
          changelogEntryVersion: 'v1.1.0',
          project: 'pkg-a',
          isVersionPlans: false,
          changelogRenderOptions: {
            authors: true,
          },
          conventionalCommitsConfig: DEFAULT_CONVENTIONAL_COMMITS_CONFIG,
        };

        expect(
          await new DefaultChangelogRenderer({
            ...otherOpts,
            entryWhenNoChanges: 'Nothing at all!',
          }).render()
        ).toMatchInlineSnapshot(`
                  "## v1.1.0

                  Nothing at all!"
              `);

        expect(
          await new DefaultChangelogRenderer({
            ...otherOpts,
            entryWhenNoChanges: false, // should not create an entry
          }).render()
        ).toMatchInlineSnapshot(`""`);
      });
    });

    describe('revert commits', () => {
      it('should generate a Revert section for the changelog if the reverted commit is not part of the same release', async () => {
        const changesWithOnlyRevert: ChangelogChange[] = [
          {
            shortHash: '6528e88aa',
            authors: [
              {
                name: 'James Henry',
                email: 'jh@example.com',
              },
            ],
            body: 'This reverts commit 6d68236d467812aba4557a2bc7f667157de80fdb.\n"\n\nM\tpackages/js/src/generators/release-version/release-version.spec.ts\nM\tpackages/js/src/generators/release-version/release-version.ts\n',
            description:
              'Revert "fix(release): do not update dependents when they already use "*" (#20607)"',
            type: 'revert',
            scope: 'release',
            githubReferences: [
              {
                type: 'pull-request',
                value: '#20607',
              },
              {
                value: '6528e88aa',
                type: 'hash',
              },
            ],
            isBreaking: false,
            revertedHashes: ['6d68236d467812aba4557a2bc7f667157de80fdb'],
            affectedProjects: ['js'],
          },
        ];

        const markdown = await new DefaultChangelogRenderer({
          changes: changesWithOnlyRevert,
          changelogEntryVersion: 'v1.1.0',
          project: null,
          isVersionPlans: false,
          entryWhenNoChanges: false,
          changelogRenderOptions: {
            authors: true,
          },
          conventionalCommitsConfig: DEFAULT_CONVENTIONAL_COMMITS_CONFIG,
        }).render();

        expect(markdown).toMatchInlineSnapshot(`
                  "## v1.1.0

                  ### ⏪ Revert

                  - **release:** Revert "fix(release): do not update dependents when they already use "*" (#20607)"

                  ### ❤️  Thank You

                  - James Henry"
              `);
      });

      it('should strip both the original commit and its revert if they are both included in the current range of commits', async () => {
        const changesWithRevertAndOriginal: ChangelogChange[] = [
          {
            shortHash: '6528e88aa',
            authors: [
              {
                name: 'James Henry',
                email: 'jh@example.com',
              },
            ],
            body: 'This reverts commit 6d68236d467812aba4557a2bc7f667157de80fdb.\n"\n\nM\tpackages/js/src/generators/release-version/release-version.spec.ts\nM\tpackages/js/src/generators/release-version/release-version.ts\n',
            description:
              'Revert "fix(release): do not update dependents when they already use "*" (#20607)"',
            type: 'revert',
            scope: 'release',
            githubReferences: [
              {
                type: 'pull-request',
                value: '#20607',
              },
              {
                value: '6528e88aa',
                type: 'hash',
              },
            ],
            isBreaking: false,
            revertedHashes: ['6d68236d467812aba4557a2bc7f667157de80fdb'],
            affectedProjects: ['js'],
          },
          {
            shortHash: '6d68236d4',
            authors: [
              {
                name: 'James Henry',
                email: 'jh@example.com',
              },
            ],
            body: '"\n\nM\tpackages/js/src/generators/release-version/release-version.spec.ts\nM\tpackages/js/src/generators/release-version/release-version.ts\n',
            description: 'do not update dependents when they already use "*"',
            type: 'fix',
            scope: 'release',
            githubReferences: [
              {
                type: 'pull-request',
                value: '#20607',
              },
              {
                value: '6d68236d4',
                type: 'hash',
              },
            ],
            isBreaking: false,
            revertedHashes: [],
            affectedProjects: ['js'],
          },
        ];

        const markdown = await new DefaultChangelogRenderer({
          changes: changesWithRevertAndOriginal,
          changelogEntryVersion: 'v1.1.0',
          project: null,
          isVersionPlans: false,
          entryWhenNoChanges: false,
          changelogRenderOptions: {
            authors: true,
          },
          conventionalCommitsConfig: DEFAULT_CONVENTIONAL_COMMITS_CONFIG,
        }).render();

        expect(markdown).toMatchInlineSnapshot(`""`);
      });
    });

    describe('breaking changes', () => {
      it('should work for breaking changes with just the ! and no explanation', async () => {
        const breakingChangeWithExplanation: ChangelogChange = {
          shortHash: '54f2f6ed1',
          authors: [
            {
              name: 'James Henry',
              email: 'jh@example.com',
            },
          ],
          body:
            'M\tpackages/rxjs/src/internal/observable/dom/WebSocketSubject.ts\n' +
            '"',
          description: 'no longer extends `Subject`.',
          type: 'feat',
          scope: 'WebSocketSubject',
          githubReferences: [{ value: '54f2f6ed1', type: 'hash' }],
          isBreaking: true,
          revertedHashes: [],
          affectedProjects: ['rxjs'],
        };

        const markdown = await new DefaultChangelogRenderer({
          changes: [breakingChangeWithExplanation],
          changelogEntryVersion: 'v1.1.0',
          project: null,
          isVersionPlans: false,
          entryWhenNoChanges: false,
          changelogRenderOptions: {
            authors: true,
          },
          conventionalCommitsConfig: DEFAULT_CONVENTIONAL_COMMITS_CONFIG,
        }).render();

        expect(markdown).toMatchInlineSnapshot(`
                  "## v1.1.0

                  ### 🚀 Features

                  - ⚠️  **WebSocketSubject:** no longer extends \`Subject\`.

                  ### ⚠️  Breaking Changes

                  - ⚠️  **WebSocketSubject:** no longer extends \`Subject\`.

                  ### ❤️  Thank You

                  - James Henry"
              `);
      });

      it('should extract the explanation of a breaking change and render it preferentially', async () => {
        const breakingChangeWithExplanation: ChangelogChange = {
          shortHash: '54f2f6ed1',
          authors: [
            {
              name: 'James Henry',
              email: 'jh@example.com',
            },
          ],
          body:
            'BREAKING CHANGE: `WebSocketSubject` is no longer `instanceof Subject`. Check for `instanceof WebSocketSubject` instead.\n' +
            '"\n' +
            '\n' +
            'M\tpackages/rxjs/src/internal/observable/dom/WebSocketSubject.ts\n' +
            '"',
          description: 'no longer extends `Subject`.',
          type: 'feat',
          scope: 'WebSocketSubject',
          githubReferences: [{ value: '54f2f6ed1', type: 'hash' }],
          isBreaking: true,
          revertedHashes: [],
          affectedProjects: ['rxjs'],
        };

        const markdown = await new DefaultChangelogRenderer({
          changes: [breakingChangeWithExplanation],
          changelogEntryVersion: 'v1.1.0',
          project: null,
          isVersionPlans: false,
          entryWhenNoChanges: false,
          changelogRenderOptions: {
            authors: true,
          },
          conventionalCommitsConfig: DEFAULT_CONVENTIONAL_COMMITS_CONFIG,
        }).render();

        expect(markdown).toMatchInlineSnapshot(`
                  "## v1.1.0

                  ### 🚀 Features

                  - ⚠️  **WebSocketSubject:** no longer extends \`Subject\`.

                  ### ⚠️  Breaking Changes

                  - **WebSocketSubject:** \`WebSocketSubject\` is no longer \`instanceof Subject\`. Check for \`instanceof WebSocketSubject\` instead.

                  ### ❤️  Thank You

                  - James Henry"
              `);
      });
    });

    describe('dependency bumps', () => {
      it('should render the dependency bumps in addition to the changes', async () => {
        expect(
          await new DefaultChangelogRenderer({
            changes,
            changelogEntryVersion: 'v1.1.0',
            entryWhenNoChanges: false as const,
            changelogRenderOptions: {
              authors: true,
            },
            isVersionPlans: false,
            conventionalCommitsConfig: DEFAULT_CONVENTIONAL_COMMITS_CONFIG,
            project: 'pkg-a',
            dependencyBumps: [
              {
                dependencyName: 'pkg-b',
                newVersion: '2.0.0',
              },
            ],
          }).render()
        ).toMatchInlineSnapshot(`
                  "## v1.1.0

                  ### 🚀 Features

                  - **pkg-a:** new hotness

                  ### 🩹 Fixes

                  - all packages fixed
                  - **pkg-a:** squashing bugs

                  ### 🧱 Updated Dependencies

                  - Updated pkg-b to 2.0.0

                  ### ❤️  Thank You

                  - James Henry"
              `);
      });

      it('should render the dependency bumps and release version title even when there are no changes', async () => {
        expect(
          await new DefaultChangelogRenderer({
            changes: [],
            changelogEntryVersion: 'v3.1.0',
            entryWhenNoChanges:
              'should not be printed because we have dependency bumps',
            changelogRenderOptions: {
              authors: true,
            },
            isVersionPlans: false,
            conventionalCommitsConfig: DEFAULT_CONVENTIONAL_COMMITS_CONFIG,
            project: 'pkg-a',
            dependencyBumps: [
              {
                dependencyName: 'pkg-b',
                newVersion: '4.0.0',
              },
            ],
          }).render()
        ).toMatchInlineSnapshot(`
                  "## v3.1.0

                  ### 🧱 Updated Dependencies

                  - Updated pkg-b to 4.0.0"
              `);
      });
    });
  });

  describe('Custom ChangelogRenderer', () => {
    it('should be possible to override individual methods of the DefaultChangelogRenderer', async () => {
      class CustomChangelogRenderer extends DefaultChangelogRenderer {
        public renderVersionTitle(): string {
          return 'Custom Version Title';
        }
      }

      const renderer = new CustomChangelogRenderer({
        changes,
        changelogEntryVersion: 'v1.1.0',
        project: null,
        isVersionPlans: false,
        entryWhenNoChanges: false,
        changelogRenderOptions: {
          authors: true,
        },
        conventionalCommitsConfig: DEFAULT_CONVENTIONAL_COMMITS_CONFIG,
      });

      const markdown = await renderer.render();
      expect(markdown).toMatchInlineSnapshot(`
        "Custom Version Title

        ### 🚀 Features

        - **pkg-a:** new hotness
        - **pkg-b:** brand new thing
        - **pkg-b:** and another new capability

        ### 🩹 Fixes

        - all packages fixed
        - **pkg-a:** squashing bugs

        ### ❤️  Thank You

        - James Henry"
      `);
    });
  });
});
