import type { GitCommit } from '../../src/command-line/release/utils/git';
import defaultChangelogRenderer from './index';

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

describe('defaultChangelogRenderer()', () => {
  const projectGraph = {
    nodes: {},
  } as any;
  const commits: GitCommit[] = [
    {
      message: 'fix: all packages fixed',
      shortHash: '4130f65',
      author: {
        name: 'James Henry',
        email: 'jh@example.com',
      },
      body: '"\n\nM\tpackages/pkg-a/src/index.ts\nM\tpackages/pkg-b/src/index.ts\n"',
      authors: [
        {
          name: 'James Henry',
          email: 'jh@example.com',
        },
      ],
      description: 'all packages fixed',
      type: 'fix',
      scope: '',
      references: [
        {
          value: '4130f65',
          type: 'hash',
        },
      ],
      isBreaking: false,
      revertedHashes: [],
      affectedFiles: [
        'packages/pkg-a/src/index.ts',
        'packages/pkg-b/src/index.ts',
      ],
    },
    {
      message: 'feat(pkg-b): and another new capability',
      shortHash: '7dc5ec3',
      author: {
        name: 'James Henry',
        email: 'jh@example.com',
      },
      body: '"\n\nM\tpackages/pkg-b/src/index.ts\n"',
      authors: [
        {
          name: 'James Henry',
          email: 'jh@example.com',
        },
      ],
      description: 'and another new capability',
      type: 'feat',
      scope: 'pkg-b',
      references: [
        {
          value: '7dc5ec3',
          type: 'hash',
        },
      ],
      isBreaking: false,
      revertedHashes: [],
      affectedFiles: ['packages/pkg-b/src/index.ts'],
    },
    {
      message: 'feat(pkg-a): new hotness',
      shortHash: 'd7a58a2',
      author: {
        name: 'James Henry',
        email: 'jh@example.com',
      },
      body: '"\n\nM\tpackages/pkg-a/src/index.ts\n"',
      authors: [
        {
          name: 'James Henry',
          email: 'jh@example.com',
        },
      ],
      description: 'new hotness',
      type: 'feat',
      scope: 'pkg-a',
      references: [
        {
          value: 'd7a58a2',
          type: 'hash',
        },
      ],
      isBreaking: false,
      revertedHashes: [],
      affectedFiles: ['packages/pkg-a/src/index.ts'],
    },
    {
      message: 'feat(pkg-b): brand new thing',
      shortHash: 'feace4a',
      author: {
        name: 'James Henry',
        email: 'jh@example.com',
      },
      body: '"\n\nM\tpackages/pkg-b/src/index.ts\n"',
      authors: [
        {
          name: 'James Henry',
          email: 'jh@example.com',
        },
      ],
      description: 'brand new thing',
      type: 'feat',
      scope: 'pkg-b',
      references: [
        {
          value: 'feace4a',
          type: 'hash',
        },
      ],
      isBreaking: false,
      revertedHashes: [],
      affectedFiles: ['packages/pkg-b/src/index.ts'],
    },
    {
      message: 'fix(pkg-a): squashing bugs',
      shortHash: '6301405',
      author: {
        name: 'James Henry',
        email: 'jh@example.com',
      },
      body: '"\n\nM\tpackages/pkg-a/src/index.ts\n',
      authors: [
        {
          name: 'James Henry',
          email: 'jh@example.com',
        },
      ],
      description: 'squashing bugs',
      type: 'fix',
      scope: 'pkg-a',
      references: [
        {
          value: '6301405',
          type: 'hash',
        },
      ],
      isBreaking: false,
      revertedHashes: [],
      affectedFiles: ['packages/pkg-a/src/index.ts'],
    },
  ];

  describe('workspaceChangelog', () => {
    it('should generate markdown for all projects by organizing commits by type, then grouped by scope within the type (sorted alphabetically), then chronologically within the scope group', async () => {
      const markdown = await defaultChangelogRenderer({
        projectGraph,
        commits,
        releaseVersion: 'v1.1.0',
        project: null,
        entryWhenNoChanges: false,
        changelogRenderOptions: {
          authors: true,
        },
      });
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
      const markdown = await defaultChangelogRenderer({
        projectGraph,
        commits,
        // Major version, should use single # for generated heading
        releaseVersion: 'v1.0.0',
        project: null,
        entryWhenNoChanges: false,
        changelogRenderOptions: {
          authors: false,
        },
      });
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
        projectGraph,
        commits,
        releaseVersion: 'v1.1.0',
        entryWhenNoChanges: false as const,
        changelogRenderOptions: {
          authors: true,
        },
      };

      expect(
        await defaultChangelogRenderer({
          ...otherOpts,
          project: 'pkg-a',
        })
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
        await defaultChangelogRenderer({
          ...otherOpts,
          project: 'pkg-a',
          // test that the authors option is being respected for project changelogs and therefore no Thank You section exists
          changelogRenderOptions: {
            authors: false,
          },
        })
      ).toMatchInlineSnapshot(`
        "## v1.1.0


        ### 🚀 Features

        - **pkg-a:** new hotness


        ### 🩹 Fixes

        - all packages fixed

        - **pkg-a:** squashing bugs"
      `);

      expect(
        await defaultChangelogRenderer({
          ...otherOpts,
          project: 'pkg-b',
        })
      ).toMatchInlineSnapshot(`
        "## v1.1.0


        ### 🚀 Features

        - **pkg-b:** brand new thing

        - **pkg-b:** and another new capability


        ### 🩹 Fixes

        - all packages fixed


        ### ❤️  Thank You

        - James Henry"
      `);
    });
  });

  describe('entryWhenNoChanges', () => {
    it('should respect the entryWhenNoChanges option for the workspace changelog', async () => {
      const otherOpts = {
        projectGraph,
        commits: [],
        releaseVersion: 'v1.1.0',
        project: null, // workspace changelog
        changelogRenderOptions: {
          authors: true,
        },
      };

      expect(
        await defaultChangelogRenderer({
          ...otherOpts,
          entryWhenNoChanges: 'Nothing at all!',
        })
      ).toMatchInlineSnapshot(`
        "## v1.1.0

        Nothing at all!"
      `);

      expect(
        await defaultChangelogRenderer({
          ...otherOpts,
          entryWhenNoChanges: false, // should not create an entry
        })
      ).toMatchInlineSnapshot(`""`);
    });

    it('should respect the entryWhenNoChanges option for project changelogs', async () => {
      const otherOpts = {
        projectGraph,
        commits: [],
        releaseVersion: 'v1.1.0',
        project: 'pkg-a',
        changelogRenderOptions: {
          authors: true,
        },
      };

      expect(
        await defaultChangelogRenderer({
          ...otherOpts,
          entryWhenNoChanges: 'Nothing at all!',
        })
      ).toMatchInlineSnapshot(`
        "## v1.1.0

        Nothing at all!"
      `);

      expect(
        await defaultChangelogRenderer({
          ...otherOpts,
          entryWhenNoChanges: false, // should not create an entry
        })
      ).toMatchInlineSnapshot(`""`);
    });
  });

  describe('revert commits', () => {
    it('should generate a Revert section for the changelog if the reverted commit is not part of the same release', async () => {
      const commitsWithOnlyRevert: GitCommit[] = [
        {
          message:
            'Revert "fix(release): do not update dependents when they already use "*" (#20607)"',
          shortHash: '6528e88aa',
          author: {
            name: 'James Henry',
            email: 'jh@example.com',
          },
          body: 'This reverts commit 6d68236d467812aba4557a2bc7f667157de80fdb.\n"\n\nM\tpackages/js/src/generators/release-version/release-version.spec.ts\nM\tpackages/js/src/generators/release-version/release-version.ts\n',
          authors: [
            {
              name: 'James Henry',
              email: 'jh@example.com',
            },
          ],
          description:
            'Revert "fix(release): do not update dependents when they already use "*" (#20607)"',
          type: 'revert',
          scope: 'release',
          references: [
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
          affectedFiles: [
            'packages/js/src/generators/release-version/release-version.spec.ts',
            'packages/js/src/generators/release-version/release-version.ts',
          ],
        },
      ];

      const markdown = await defaultChangelogRenderer({
        projectGraph,
        commits: commitsWithOnlyRevert,
        releaseVersion: 'v1.1.0',
        project: null,
        entryWhenNoChanges: false,
        changelogRenderOptions: {
          authors: true,
        },
      });

      expect(markdown).toMatchInlineSnapshot(`
        "## v1.1.0


        ### ⏪ Revert

        - **release:** Revert "fix(release): do not update dependents when they already use "*" (#20607)"

        ### ❤️  Thank You

        - James Henry"
      `);
    });

    it('should strip both the original commit and its revert if they are both included in the current range of commits', async () => {
      const commitsWithRevertAndOriginal: GitCommit[] = [
        {
          message:
            'Revert "fix(release): do not update dependents when they already use "*" (#20607)"',
          shortHash: '6528e88aa',
          author: {
            name: 'James Henry',
            email: 'jh@example.com',
          },
          body: 'This reverts commit 6d68236d467812aba4557a2bc7f667157de80fdb.\n"\n\nM\tpackages/js/src/generators/release-version/release-version.spec.ts\nM\tpackages/js/src/generators/release-version/release-version.ts\n',
          authors: [
            {
              name: 'James Henry',
              email: 'jh@example.com',
            },
          ],
          description:
            'Revert "fix(release): do not update dependents when they already use "*" (#20607)"',
          type: 'revert',
          scope: 'release',
          references: [
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
          affectedFiles: [
            'packages/js/src/generators/release-version/release-version.spec.ts',
            'packages/js/src/generators/release-version/release-version.ts',
          ],
        },
        {
          message:
            'fix(release): do not update dependents when they already use "*" (#20607)',
          shortHash: '6d68236d4',
          author: {
            name: 'James Henry',
            email: 'jh@example.com',
          },
          body: '"\n\nM\tpackages/js/src/generators/release-version/release-version.spec.ts\nM\tpackages/js/src/generators/release-version/release-version.ts\n',
          authors: [
            {
              name: 'James Henry',
              email: 'jh@example.com',
            },
          ],
          description: 'do not update dependents when they already use "*"',
          type: 'fix',
          scope: 'release',
          references: [
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
          affectedFiles: [
            'packages/js/src/generators/release-version/release-version.spec.ts',
            'packages/js/src/generators/release-version/release-version.ts',
          ],
        },
      ];

      const markdown = await defaultChangelogRenderer({
        projectGraph,
        commits: commitsWithRevertAndOriginal,
        releaseVersion: 'v1.1.0',
        project: null,
        entryWhenNoChanges: false,
        changelogRenderOptions: {
          authors: true,
        },
      });

      expect(markdown).toMatchInlineSnapshot(`""`);
    });
  });

  describe('breaking changes', () => {
    it('should work for breaking changes with just the ! and no explanation', async () => {
      const breakingChangeCommitWithExplanation: GitCommit = {
        // ! after the type, no BREAKING CHANGE: in the body
        message: 'feat(WebSocketSubject)!: no longer extends `Subject`.',
        shortHash: '54f2f6ed1',
        author: {
          name: 'James Henry',
          email: 'jh@example.com',
        },
        body:
          'M\tpackages/rxjs/src/internal/observable/dom/WebSocketSubject.ts\n' +
          '"',
        authors: [
          {
            name: 'James Henry',
            email: 'jh@example.com',
          },
        ],
        description: 'no longer extends `Subject`.',
        type: 'feat',
        scope: 'WebSocketSubject',
        references: [{ value: '54f2f6ed1', type: 'hash' }],
        isBreaking: true,
        revertedHashes: [],
        affectedFiles: [
          'packages/rxjs/src/internal/observable/dom/WebSocketSubject.ts',
        ],
      };

      const markdown = await defaultChangelogRenderer({
        projectGraph,
        commits: [breakingChangeCommitWithExplanation],
        releaseVersion: 'v1.1.0',
        project: null,
        entryWhenNoChanges: false,
        changelogRenderOptions: {
          authors: true,
        },
      });

      expect(markdown).toMatchInlineSnapshot(`
        "## v1.1.0


        ### 🚀 Features

        - ⚠️  **WebSocketSubject:** no longer extends \`Subject\`.

        #### ⚠️  Breaking Changes

        - ⚠️  **WebSocketSubject:** no longer extends \`Subject\`.

        ### ❤️  Thank You

        - James Henry"
      `);
    });

    it('should extract the explanation of a breaking change and render it preferentially', async () => {
      const breakingChangeCommitWithExplanation: GitCommit = {
        // No ! after the type, but BREAKING CHANGE: in the body
        message: 'feat(WebSocketSubject): no longer extends `Subject`.',
        shortHash: '54f2f6ed1',
        author: {
          name: 'James Henry',
          email: 'jh@example.com',
        },
        body:
          'BREAKING CHANGE: `WebSocketSubject` is no longer `instanceof Subject`. Check for `instanceof WebSocketSubject` instead.\n' +
          '"\n' +
          '\n' +
          'M\tpackages/rxjs/src/internal/observable/dom/WebSocketSubject.ts\n' +
          '"',
        authors: [
          {
            name: 'James Henry',
            email: 'jh@example.com',
          },
        ],
        description: 'no longer extends `Subject`.',
        type: 'feat',
        scope: 'WebSocketSubject',
        references: [{ value: '54f2f6ed1', type: 'hash' }],
        isBreaking: true,
        revertedHashes: [],
        affectedFiles: [
          'packages/rxjs/src/internal/observable/dom/WebSocketSubject.ts',
        ],
      };

      const markdown = await defaultChangelogRenderer({
        projectGraph,
        commits: [breakingChangeCommitWithExplanation],
        releaseVersion: 'v1.1.0',
        project: null,
        entryWhenNoChanges: false,
        changelogRenderOptions: {
          authors: true,
        },
      });

      expect(markdown).toMatchInlineSnapshot(`
        "## v1.1.0


        ### 🚀 Features

        - ⚠️  **WebSocketSubject:** no longer extends \`Subject\`.

        #### ⚠️  Breaking Changes

        - **WebSocketSubject:** \`WebSocketSubject\` is no longer \`instanceof Subject\`. Check for \`instanceof WebSocketSubject\` instead.

        ### ❤️  Thank You

        - James Henry"
      `);
    });
  });
});
