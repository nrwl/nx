import { parseChangelogMarkdown } from './markdown';

describe('markdown utils', () => {
  describe('parseChangelogMarkdown()', () => {
    it('should extract the versions from the given markdown', () => {
      const markdown = `
## 0.0.3


### 🩹 Fixes

- **baz:** bugfix for baz

### ❤️ Thank You

- James Henry

## 0.0.2


### 🚀 Features

- **foo:** some feature in foo

### 🩹 Fixes

- **bar:** some bugfix in bar

### ❤️ Thank You

- James Henry
    `;
      expect(parseChangelogMarkdown(markdown)).toMatchInlineSnapshot(`
        {
          "releases": [
            {
              "body": "### 🩹 Fixes

        - **baz:** bugfix for baz

        ### ❤️ Thank You

        - James Henry",
              "version": "0.0.3",
            },
            {
              "body": "### 🚀 Features

        - **foo:** some feature in foo

        ### 🩹 Fixes

        - **bar:** some bugfix in bar

        ### ❤️ Thank You

        - James Henry",
              "version": "0.0.2",
            },
          ],
        }
      `);
    });

    it('should work for prerelease versions', () => {
      const markdown = `
## 0.0.3-alpha.1


### 🩹 Fixes

- **baz:** bugfix for baz

### ❤️ Thank You

- James Henry

## 0.0.2-beta.256


### 🚀 Features

- **foo:** some feature in foo

### 🩹 Fixes

- **bar:** some bugfix in bar

### ❤️ Thank You

- James Henry
    `;
      expect(parseChangelogMarkdown(markdown)).toMatchInlineSnapshot(`
        {
          "releases": [
            {
              "body": "### 🩹 Fixes

        - **baz:** bugfix for baz

        ### ❤️ Thank You

        - James Henry",
              "version": "0.0.3-alpha.1",
            },
            {
              "body": "### 🚀 Features

        - **foo:** some feature in foo

        ### 🩹 Fixes

        - **bar:** some bugfix in bar

        ### ❤️ Thank You

        - James Henry",
              "version": "0.0.2-beta.256",
            },
          ],
        }
      `);
    });

    it('should work for major versions using a single #', () => {
      const markdown = `
## 1.0.1


### 🩹 Fixes

- **baz:** bugfix for baz

### ❤️ Thank You

- James Henry

# 1.0.0


### 🚀 Features

- **foo:** some feature in foo

### 🩹 Fixes

- **bar:** some bugfix in bar

### ❤️ Thank You

- James Henry
    `;
      expect(parseChangelogMarkdown(markdown)).toMatchInlineSnapshot(`
        {
          "releases": [
            {
              "body": "### 🩹 Fixes

        - **baz:** bugfix for baz

        ### ❤️ Thank You

        - James Henry",
              "version": "1.0.1",
            },
            {
              "body": "### 🚀 Features

        - **foo:** some feature in foo

        ### 🩹 Fixes

        - **bar:** some bugfix in bar

        ### ❤️ Thank You

        - James Henry",
              "version": "1.0.0",
            },
          ],
        }
      `);
    });

    it('should only treat a heading at the start of a \\n separated line as a release', () => {
      const markdown = [
        '## 1.0.1',
        '',
        '### ❤️ Thank You',
        '',
        '- Mallory\r## 1.0.2\u2028## 1.1.0\u2029## 2.0.0',
        '',
        '## 1.0.0\r',
        '\r',
        '- Initial release\r',
      ].join('\n');
      expect(
        parseChangelogMarkdown(markdown).releases.map((r) => r.version)
      ).toEqual(['1.0.1', '1.0.0']);
    });
  });
});
