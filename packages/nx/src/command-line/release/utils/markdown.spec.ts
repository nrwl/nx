import { parseChangelogMarkdown } from './markdown';

describe('markdown utils', () => {
  describe('parseChangelogMarkdown()', () => {
    it('should extract the versions from the given markdown', () => {
      const markdown = `
## 0.0.3


### 🩹 Fixes

- **baz:** bugfix for baz

### ❤️  Thank You

- James Henry

## 0.0.2


### 🚀 Features

- **foo:** some feature in foo

### 🩹 Fixes

- **bar:** some bugfix in bar

### ❤️  Thank You

- James Henry
    `;
      expect(parseChangelogMarkdown(markdown)).toMatchInlineSnapshot(`
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
  });
});
