import { parseChangelogMarkdown, replaceChangelogRelease } from './markdown';

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
  });

  describe('replaceChangelogRelease()', () => {
    it('should replace an entry whose heading includes a date', () => {
      const markdown = `## 1.1.0 (2026-09-17)

### 🚀 Features

- **foo:** some feature in foo

### 🩹 Fixes

- **bar:** some bugfix in bar

## 1.0.0 (2026-09-01)

### 🩹 Fixes

- **baz:** bugfix for baz
`;
      expect(
        replaceChangelogRelease(
          markdown,
          '1.1.0',
          `## 1.1.0 (2026-09-18)

### 🩹 Fixes

- **bar:** some bugfix in bar`
        )
      ).toEqual(`## 1.1.0 (2026-09-18)

### 🩹 Fixes

- **bar:** some bugfix in bar

## 1.0.0 (2026-09-01)

### 🩹 Fixes

- **baz:** bugfix for baz
`);
    });

    it('should replace a major version entry using a single #', () => {
      const markdown = `## 2.0.1

### 🩹 Fixes

- **baz:** bugfix for baz

# 2.0.0

### 🚀 Features

- **foo:** some feature in foo
`;
      expect(
        replaceChangelogRelease(
          markdown,
          '2.0.0',
          `# 2.0.0

### 🚀 Features

- **foo:** another feature in foo`
        )
      ).toEqual(`## 2.0.1

### 🩹 Fixes

- **baz:** bugfix for baz

# 2.0.0

### 🚀 Features

- **foo:** another feature in foo
`);
    });

    it('should leave the contents unchanged when the version has no entry', () => {
      const markdown = `## 1.0.0

### 🩹 Fixes

- **baz:** bugfix for baz
`;
      expect(replaceChangelogRelease(markdown, '1.1.0', '## 1.1.0')).toEqual(
        markdown
      );
    });
  });
});
