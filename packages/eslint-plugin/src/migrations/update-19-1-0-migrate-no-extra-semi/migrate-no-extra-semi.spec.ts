import { Tree, readJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import migrate from './migrate-no-extra-semi';

describe('update-19-1-0-migrate-no-extra-semi', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('top level config', () => {
    it('should not update top level config that does not extend @nx/typescript or @nx/javascript', async () => {
      writeJson(tree, '.eslintrc.json', {
        plugins: ['@nx'],
        rules: {},
      });

      await migrate(tree);

      expect(readJson(tree, '.eslintrc.json')).toMatchInlineSnapshot(`
        {
          "plugins": [
            "@nx",
          ],
          "rules": {},
        }
      `);
    });

    it('should update top level config that extends @nx/typescript', async () => {
      writeJson(tree, '.eslintrc.json', {
        plugins: ['@nx'],
        extends: ['@nx/typescript'],
        rules: {},
      });

      await migrate(tree);

      expect(readJson(tree, '.eslintrc.json')).toMatchInlineSnapshot(`
        {
          "extends": [
            "@nx/typescript",
          ],
          "plugins": [
            "@nx",
          ],
          "rules": {
            "@typescript-eslint/no-extra-semi": "error",
            "no-extra-semi": "off",
          },
        }
      `);

      writeJson(tree, '.eslintrc.json', {
        plugins: ['@nx'],
        extends: ['plugin:@nx/typescript'], // alt syntax
        rules: {},
      });

      await migrate(tree);

      expect(readJson(tree, '.eslintrc.json')).toMatchInlineSnapshot(`
        {
          "extends": [
            "plugin:@nx/typescript",
          ],
          "plugins": [
            "@nx",
          ],
          "rules": {
            "@typescript-eslint/no-extra-semi": "error",
            "no-extra-semi": "off",
          },
        }
      `);
    });

    it('should update top level config that extends @nx/typescript and "rules" is not defined', async () => {
      writeJson(tree, '.eslintrc.json', {
        plugins: ['@nx'],
        extends: ['@nx/typescript'],
      });

      await migrate(tree);

      expect(readJson(tree, '.eslintrc.json')).toMatchInlineSnapshot(`
        {
          "extends": [
            "@nx/typescript",
          ],
          "plugins": [
            "@nx",
          ],
          "rules": {
            "@typescript-eslint/no-extra-semi": "error",
            "no-extra-semi": "off",
          },
        }
      `);

      writeJson(tree, '.eslintrc.json', {
        plugins: ['@nx'],
        extends: ['plugin:@nx/typescript'], // alt syntax
      });

      await migrate(tree);

      expect(readJson(tree, '.eslintrc.json')).toMatchInlineSnapshot(`
        {
          "extends": [
            "plugin:@nx/typescript",
          ],
          "plugins": [
            "@nx",
          ],
          "rules": {
            "@typescript-eslint/no-extra-semi": "error",
            "no-extra-semi": "off",
          },
        }
      `);
    });

    it('should update top level config that extends @nx/javascript', async () => {
      writeJson(tree, '.eslintrc.json', {
        plugins: ['@nx'],
        extends: ['@nx/javascript'],
        rules: {},
      });

      await migrate(tree);

      expect(readJson(tree, '.eslintrc.json')).toMatchInlineSnapshot(`
        {
          "extends": [
            "@nx/javascript",
          ],
          "plugins": [
            "@nx",
          ],
          "rules": {
            "@typescript-eslint/no-extra-semi": "error",
            "no-extra-semi": "off",
          },
        }
      `);

      writeJson(tree, '.eslintrc.json', {
        plugins: ['@nx'],
        extends: ['plugin:@nx/javascript'], // alt syntax
        rules: {},
      });

      await migrate(tree);

      expect(readJson(tree, '.eslintrc.json')).toMatchInlineSnapshot(`
        {
          "extends": [
            "plugin:@nx/javascript",
          ],
          "plugins": [
            "@nx",
          ],
          "rules": {
            "@typescript-eslint/no-extra-semi": "error",
            "no-extra-semi": "off",
          },
        }
      `);
    });

    it('should update top level config that extends @nx/javascript and "rules" is not defined', async () => {
      writeJson(tree, '.eslintrc.json', {
        plugins: ['@nx'],
        extends: ['@nx/javascript'],
      });

      await migrate(tree);

      expect(readJson(tree, '.eslintrc.json')).toMatchInlineSnapshot(`
        {
          "extends": [
            "@nx/javascript",
          ],
          "plugins": [
            "@nx",
          ],
          "rules": {
            "@typescript-eslint/no-extra-semi": "error",
            "no-extra-semi": "off",
          },
        }
      `);

      writeJson(tree, '.eslintrc.json', {
        plugins: ['@nx'],
        extends: ['plugin:@nx/javascript'], // alt syntax
      });

      await migrate(tree);

      expect(readJson(tree, '.eslintrc.json')).toMatchInlineSnapshot(`
        {
          "extends": [
            "plugin:@nx/javascript",
          ],
          "plugins": [
            "@nx",
          ],
          "rules": {
            "@typescript-eslint/no-extra-semi": "error",
            "no-extra-semi": "off",
          },
        }
      `);
    });

    it('should not update top level config that already defines the rules', async () => {
      writeJson(tree, '.eslintrc.json', {
        plugins: ['@nx'],
        extends: ['@nx/typescript'],
        rules: {
          'no-extra-semi': 'warn', // custom setting
          '@typescript-eslint/no-extra-semi': 'warn', // custom setting
        },
      });

      await migrate(tree);

      expect(readJson(tree, '.eslintrc.json')).toMatchInlineSnapshot(`
        {
          "extends": [
            "@nx/typescript",
          ],
          "plugins": [
            "@nx",
          ],
          "rules": {
            "@typescript-eslint/no-extra-semi": "warn",
            "no-extra-semi": "warn",
          },
        }
      `);
    });
  });

  describe('overrides', () => {
    it('should not update overrides config that does not extend @nx/typescript or @nx/javascript', async () => {
      writeJson(tree, 'path/to/.eslintrc.json', {
        overrides: [
          {
            files: ['*.ts'],
            plugins: ['@nx'],
            rules: {},
          },
          {
            files: ['*.js'],
            plugins: ['@nx'],
            rules: {},
          },
        ],
      });

      await migrate(tree);

      expect(readJson(tree, 'path/to/.eslintrc.json')).toMatchInlineSnapshot(`
        {
          "overrides": [
            {
              "files": [
                "*.ts",
              ],
              "plugins": [
                "@nx",
              ],
              "rules": {},
            },
            {
              "files": [
                "*.js",
              ],
              "plugins": [
                "@nx",
              ],
              "rules": {},
            },
          ],
        }
      `);
    });

    it('should update overrides config that extends @nx/typescript', async () => {
      writeJson(tree, 'path/to/.eslintrc.json', {
        overrides: [
          {
            files: ['*.ts'],
            extends: ['@nx/typescript'],
            rules: {},
          },
          {
            files: ['*.tsx'],
            extends: ['plugin:@nx/typescript'], // alt syntax
            rules: {},
          },
          {
            // Should be untouched
            files: ['*.js'],
            plugins: ['@nx'],
            rules: {},
          },
        ],
      });

      await migrate(tree);

      expect(readJson(tree, 'path/to/.eslintrc.json')).toMatchInlineSnapshot(`
        {
          "overrides": [
            {
              "extends": [
                "@nx/typescript",
              ],
              "files": [
                "*.ts",
              ],
              "rules": {
                "@typescript-eslint/no-extra-semi": "error",
                "no-extra-semi": "off",
              },
            },
            {
              "extends": [
                "plugin:@nx/typescript",
              ],
              "files": [
                "*.tsx",
              ],
              "rules": {
                "@typescript-eslint/no-extra-semi": "error",
                "no-extra-semi": "off",
              },
            },
            {
              "files": [
                "*.js",
              ],
              "plugins": [
                "@nx",
              ],
              "rules": {},
            },
          ],
        }
      `);
    });

    it('should update overrides config that extends @nx/typescript and "rules" is not defined', async () => {
      writeJson(tree, 'path/to/.eslintrc.json', {
        overrides: [
          {
            files: ['*.ts'],
            extends: ['@nx/typescript'],
          },
          {
            files: ['*.tsx'],
            extends: ['plugin:@nx/typescript'], // alt syntax
          },
          {
            // Should be untouched
            files: ['*.js'],
            plugins: ['@nx'],
            rules: {},
          },
        ],
      });

      await migrate(tree);

      expect(readJson(tree, 'path/to/.eslintrc.json')).toMatchInlineSnapshot(`
        {
          "overrides": [
            {
              "extends": [
                "@nx/typescript",
              ],
              "files": [
                "*.ts",
              ],
              "rules": {
                "@typescript-eslint/no-extra-semi": "error",
                "no-extra-semi": "off",
              },
            },
            {
              "extends": [
                "plugin:@nx/typescript",
              ],
              "files": [
                "*.tsx",
              ],
              "rules": {
                "@typescript-eslint/no-extra-semi": "error",
                "no-extra-semi": "off",
              },
            },
            {
              "files": [
                "*.js",
              ],
              "plugins": [
                "@nx",
              ],
              "rules": {},
            },
          ],
        }
      `);
    });

    it('should update overrides config that extends @nx/javascript', async () => {
      writeJson(tree, '.eslintrc.json', {
        overrides: [
          {
            files: ['*.js'],
            extends: ['@nx/javascript'],
            rules: {},
          },
          {
            files: ['*.jsx'],
            extends: ['plugin:@nx/javascript'], // alt syntax
            rules: {},
          },
          {
            // Should be untouched
            files: ['*.js'],
            plugins: ['@nx'],
            rules: {},
          },
        ],
      });

      await migrate(tree);

      expect(readJson(tree, '.eslintrc.json')).toMatchInlineSnapshot(`
        {
          "overrides": [
            {
              "extends": [
                "@nx/javascript",
              ],
              "files": [
                "*.js",
              ],
              "rules": {
                "@typescript-eslint/no-extra-semi": "error",
                "no-extra-semi": "off",
              },
            },
            {
              "extends": [
                "plugin:@nx/javascript",
              ],
              "files": [
                "*.jsx",
              ],
              "rules": {
                "@typescript-eslint/no-extra-semi": "error",
                "no-extra-semi": "off",
              },
            },
            {
              "files": [
                "*.js",
              ],
              "plugins": [
                "@nx",
              ],
              "rules": {},
            },
          ],
        }
      `);
    });

    it('should update overrides config that extends @nx/javascript and "rules" is not defined', async () => {
      writeJson(tree, '.eslintrc.json', {
        overrides: [
          {
            files: ['*.js'],
            extends: ['@nx/javascript'],
          },
          {
            files: ['*.jsx'],
            extends: ['plugin:@nx/javascript'], // alt syntax
          },
          {
            // Should be untouched
            files: ['*.js'],
            plugins: ['@nx'],
            rules: {},
          },
        ],
      });

      await migrate(tree);

      expect(readJson(tree, '.eslintrc.json')).toMatchInlineSnapshot(`
        {
          "overrides": [
            {
              "extends": [
                "@nx/javascript",
              ],
              "files": [
                "*.js",
              ],
              "rules": {
                "@typescript-eslint/no-extra-semi": "error",
                "no-extra-semi": "off",
              },
            },
            {
              "extends": [
                "plugin:@nx/javascript",
              ],
              "files": [
                "*.jsx",
              ],
              "rules": {
                "@typescript-eslint/no-extra-semi": "error",
                "no-extra-semi": "off",
              },
            },
            {
              "files": [
                "*.js",
              ],
              "plugins": [
                "@nx",
              ],
              "rules": {},
            },
          ],
        }
      `);
    });

    it('should not update overrides config that already defines the rules', async () => {
      writeJson(tree, '.eslintrc.json', {
        overrides: [
          {
            files: ['*.ts'],
            extends: ['@nx/typescript'],
            rules: {
              // Custom settings
              '@typescript-eslint/no-extra-semi': 'warn',
              'no-extra-semi': 'warn',
            },
          },
          {
            files: ['*.tsx'],
            extends: ['plugin:@nx/typescript'], // alt syntax
            rules: {
              // Custom settings
              '@typescript-eslint/no-extra-semi': 'warn',
              'no-extra-semi': 'warn',
            },
          },
          {
            files: ['*.js'],
            extends: ['@nx/javascript'],
            rules: {
              // Custom settings
              '@typescript-eslint/no-extra-semi': 'warn',
              'no-extra-semi': 'warn',
            },
          },
          {
            files: ['*.jsx'],
            extends: ['plugin:@nx/javascript'], // alt syntax
            rules: {
              // Custom settings
              '@typescript-eslint/no-extra-semi': 'warn',
              'no-extra-semi': 'warn',
            },
          },
        ],
      });

      await migrate(tree);

      expect(readJson(tree, '.eslintrc.json')).toMatchInlineSnapshot(`
        {
          "overrides": [
            {
              "extends": [
                "@nx/typescript",
              ],
              "files": [
                "*.ts",
              ],
              "rules": {
                "@typescript-eslint/no-extra-semi": "warn",
                "no-extra-semi": "warn",
              },
            },
            {
              "extends": [
                "plugin:@nx/typescript",
              ],
              "files": [
                "*.tsx",
              ],
              "rules": {
                "@typescript-eslint/no-extra-semi": "warn",
                "no-extra-semi": "warn",
              },
            },
            {
              "extends": [
                "@nx/javascript",
              ],
              "files": [
                "*.js",
              ],
              "rules": {
                "@typescript-eslint/no-extra-semi": "warn",
                "no-extra-semi": "warn",
              },
            },
            {
              "extends": [
                "plugin:@nx/javascript",
              ],
              "files": [
                "*.jsx",
              ],
              "rules": {
                "@typescript-eslint/no-extra-semi": "warn",
                "no-extra-semi": "warn",
              },
            },
          ],
        }
      `);
    });
  });
});
