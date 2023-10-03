import { GitCommit } from './git';
import { parseChangelogMarkdown, generateMarkdown } from './markdown';

describe('markdown utils', () => {
  describe('generateMarkdown()', () => {
    it('should generate markdown for commits organized by type, then grouped by scope within the type (sorted alphabetically), then chronologically within the scope group', async () => {
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
        },
      ];

      expect(await generateMarkdown(commits, 'v1.1.0')).toMatchInlineSnapshot(`
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
  });

  describe('parseChangelogMarkdown()', () => {
    it('should extract the versions from the given markdown', () => {
      const markdown = `
## v0.0.3


### 🩹 Fixes

- **baz:** bugfix for baz

### ❤️  Thank You

- James Henry

## v0.0.2


### 🚀 Features

- **foo:** some feature in foo

### 🩹 Fixes

- **bar:** some bugfix in bar

### ❤️  Thank You

- James Henry
    `;
      expect(parseChangelogMarkdown(markdown, 'v')).toMatchInlineSnapshot(`
        {
          "releases": [
            {
              "body": "### 🩹 Fixes

        - **baz:** bugfix for baz

        ### ❤️  Thank You

        - James Henry",
              "version": "0.0.3",
            },
            {
              "body": "### 🚀 Features

        - **foo:** some feature in foo

        ### 🩹 Fixes

        - **bar:** some bugfix in bar

        ### ❤️  Thank You

        - James Henry",
              "version": "0.0.2",
            },
          ],
        }
      `);
    });

    it('should work for custom tagVersionPrefix values', () => {
      expect(
        // Empty string - no prefix
        parseChangelogMarkdown(
          `
## 0.0.3


### 🩹 Fixes

- **baz:** bugfix for baz

## 0.0.2


### 🚀 Features

- **foo:** some feature in foo

`,
          ''
        )
      ).toMatchInlineSnapshot(`
        {
          "releases": [
            {
              "body": "### 🩹 Fixes

        - **baz:** bugfix for baz",
              "version": "0.0.3",
            },
            {
              "body": "### 🚀 Features

        - **foo:** some feature in foo",
              "version": "0.0.2",
            },
          ],
        }
      `);

      expect(
        parseChangelogMarkdown(
          `
## v.0.0.3


### 🩹 Fixes

- **baz:** bugfix for baz

## v.0.0.2


### 🚀 Features

- **foo:** some feature in foo
  
  `,
          'v.' // multi-character, and including regex special character
        )
      ).toMatchInlineSnapshot(`
        {
          "releases": [
            {
              "body": "### 🩹 Fixes

        - **baz:** bugfix for baz",
              "version": "0.0.3",
            },
            {
              "body": "### 🚀 Features

        - **foo:** some feature in foo",
              "version": "0.0.2",
            },
          ],
        }
      `);
    });
  });
});
