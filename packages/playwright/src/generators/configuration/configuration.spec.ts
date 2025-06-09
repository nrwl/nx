import 'nx/src/internal-testing-utils/mock-project-graph';

import { Tree, updateJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import configGenerator from './configuration';

describe('Playwright e2e configuration', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  describe('TS Solution Setup', () => {
    beforeEach(() => {
      updateJson(tree, 'package.json', (json) => {
        json.workspaces = ['packages/*', 'apps/*'];
        return json;
      });
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          composite: true,
          declaration: true,
        },
      });
      writeJson(tree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        files: [],
        references: [],
      });
    });

    it('should create tsconfig.json if it does not exist yet (default case for app generators)', async () => {
      writeJson(tree, 'apps/myapp-e2e/package.json', {
        name: '@proj/myapp-e2e',
      });

      await configGenerator(tree, {
        project: '@proj/myapp-e2e',
      });

      expect(tree.read('apps/myapp-e2e/tsconfig.json', 'utf-8'))
        .toMatchInlineSnapshot(`
        "{
          "extends": "../../tsconfig.base.json",
          "compilerOptions": {
            "allowJs": true,
            "outDir": "out-tsc/playwright",
            "sourceMap": false
          },
          "include": [
            "**/*.ts",
            "**/*.js",
            "playwright.config.ts",
            "src/**/*.spec.ts",
            "src/**/*.spec.js",
            "src/**/*.test.ts",
            "src/**/*.test.js",
            "src/**/*.d.ts"
          ],
          "exclude": ["out-tsc", "test-output"]
        }
        "
      `);
      expect(tree.exists('apps/myapp/tsconfig.e2e.json')).toBeFalsy();
    });

    it('should use tsconfig.e2e.json if tsconfig.json already exists', async () => {
      writeJson(tree, 'apps/myapp/package.json', {
        name: '@proj/myapp',
      });
      writeJson(tree, 'apps/myapp/tsconfig.json', {
        include: [],
        files: [],
        references: [],
      });

      await configGenerator(tree, {
        project: '@proj/myapp',
      });

      expect(tree.read('apps/myapp/tsconfig.json', 'utf-8'))
        .toMatchInlineSnapshot(`
        "{
          "include": [],
          "files": [],
          "references": [
            {
              "path": "./tsconfig.e2e.json"
            }
          ]
        }
        "
      `);
      expect(tree.read('apps/myapp/tsconfig.e2e.json', 'utf-8'))
        .toMatchInlineSnapshot(`
        "{
          "extends": "../../tsconfig.base.json",
          "compilerOptions": {
            "allowJs": true,
            "outDir": "out-tsc/playwright",
            "sourceMap": false
          },
          "include": ["e2e/**/*.ts", "e2e/**/*.js", "playwright.config.ts"],
          "exclude": ["out-tsc", "test-output"]
        }
        "
      `);
    });

    it('should ignore Playwright output files in eslint config if used', async () => {
      tree.write('eslint.config.mjs', `export default [{ ignores: [] }];`);
      writeJson(tree, 'apps/myapp/package.json', {
        name: '@proj/myapp',
      });
      writeJson(tree, 'apps/myapp/tsconfig.json', {
        include: [],
        files: [],
        references: [],
      });

      await configGenerator(tree, {
        project: '@proj/myapp',
        linter: 'eslint',
      });

      expect(tree.read('eslint.config.mjs', 'utf-8')).toMatchInlineSnapshot(`
        "export default [{ ignores: ['**/test-output'] }];
        "
      `);
    });
  });
});
