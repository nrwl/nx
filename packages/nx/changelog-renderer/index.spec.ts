import type { GitCommit } from '../src/command-line/release/utils/git';
import defaultChangelogRenderer from './index';

describe('defaultChangelogRenderer()', () => {
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
      affectedFiles: [],
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
      affectedFiles: [],
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
      affectedFiles: [],
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
      affectedFiles: [],
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
      affectedFiles: [],
    },
  ];

  describe('workspaceChangelog', () => {
    it('should generate markdown for all projects by organizing commits by type, then grouped by scope within the type (sorted alphabetically), then chronologically within the scope group', async () => {
      const markdown = await defaultChangelogRenderer({
        commits,
        releaseVersion: 'v1.1.0',
        project: null,
        entryWhenNoChanges: false,
        changelogRenderOptions: {
          includeAuthors: true,
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

    it('should not generate a Thank You section when changelogRenderOptions.includeAuthors is false', async () => {
      const markdown = await defaultChangelogRenderer({
        commits,
        releaseVersion: 'v1.1.0',
        project: null,
        entryWhenNoChanges: false,
        changelogRenderOptions: {
          includeAuthors: false,
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
        - **pkg-a:** squashing bugs"
      `);
    });
  });

  describe('project level configs', () => {
    it('should generate markdown for the given project by organizing commits by type, then chronologically', async () => {
      const otherOpts = {
        commits,
        releaseVersion: 'v1.1.0',
        entryWhenNoChanges: false as const,
        changelogRenderOptions: {
          includeAuthors: true,
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

        - **pkg-a:** squashing bugs


        ### ❤️  Thank You

        - James Henry"
      `);

      expect(
        await defaultChangelogRenderer({
          ...otherOpts,
          project: 'pkg-a',
          // test that the includeAuthors option is being respected for project changelogs and therefore no Thank You section exists
          changelogRenderOptions: {
            includeAuthors: false,
          },
        })
      ).toMatchInlineSnapshot(`
        "## v1.1.0


        ### 🚀 Features

        - **pkg-a:** new hotness


        ### 🩹 Fixes

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


        ### ❤️  Thank You

        - James Henry"
      `);
    });
  });

  describe('entryWhenNoChanges', () => {
    it('should respect the entryWhenNoChanges option for the workspace changelog', async () => {
      const otherOpts = {
        commits: [],
        releaseVersion: 'v1.1.0',
        project: null, // workspace changelog
        changelogRenderOptions: {
          includeAuthors: true,
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
        commits: [],
        releaseVersion: 'v1.1.0',
        project: 'pkg-a',
        changelogRenderOptions: {
          includeAuthors: true,
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
});
