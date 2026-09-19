import '@nx/devkit/internal-testing-utils/mock-project-graph';

import {
  addProjectConfiguration,
  readJson,
  Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
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

  describe('legacy .eslintrc stack', () => {
    beforeEach(() => {
      tree.write('.eslintrc.json', '{}');
      addProjectConfiguration(tree, 'myapp-e2e', { root: 'apps/myapp-e2e' });
    });

    it('should set parserOptions.project when typed linting is enabled', async () => {
      await configGenerator(tree, {
        project: 'myapp-e2e',
        directory: 'src',
        linter: 'eslint',
        enableTypedLinting: true,
      });

      const eslintConfig = readJson(tree, 'apps/myapp-e2e/.eslintrc.json');
      const override = eslintConfig.overrides.find((o) =>
        o.files?.includes('src/**/*.{ts,js,tsx,jsx}')
      );
      expect(override.parserOptions).toEqual({
        project: 'apps/myapp-e2e/tsconfig.*?.json',
      });
      expect(tree.read('apps/myapp-e2e/.eslintrc.json', 'utf-8')).not.toContain(
        'projectService'
      );
    });

    it('should not set parserOptions when typed linting is disabled', async () => {
      await configGenerator(tree, {
        project: 'myapp-e2e',
        directory: 'src',
        linter: 'eslint',
      });

      const eslintConfig = readJson(tree, 'apps/myapp-e2e/.eslintrc.json');
      expect(eslintConfig.overrides.some((o) => o.parserOptions)).toBe(false);
    });
  });

  describe('webServer', () => {
    beforeEach(() => {
      addProjectConfiguration(tree, 'myapp-e2e', { root: 'apps/myapp-e2e' });
    });

    const readConfig = () =>
      tree.read('apps/myapp-e2e/playwright.config.mts', 'utf-8');

    it('should use the one web server everywhere when no CI server is given', async () => {
      await configGenerator(tree, {
        project: 'myapp-e2e',
        webServerCommand: 'npx nx run myapp:serve-static',
        webServerAddress: 'http://localhost:4200',
      });

      const config = readConfig();
      expect(config).toContain("command: 'npx nx run myapp:serve-static',");
      expect(config).toContain("url: 'http://localhost:4200',");
      expect(config).not.toContain('isCI');
    });

    it('should switch to the CI web server when CI is set', async () => {
      await configGenerator(tree, {
        project: 'myapp-e2e',
        webServerCommand: 'npx nx run myapp:serve',
        webServerAddress: 'http://localhost:4200',
        ciWebServerCommand: 'npx nx run myapp:preview',
        ciWebServerAddress: 'http://localhost:4300',
      });

      const config = readConfig();
      expect(config).toContain(
        "const webServerAddress = isCI ? 'http://localhost:4300' : 'http://localhost:4200';"
      );
      expect(config).toContain(
        "const baseURL = process.env['BASE_URL'] || webServerAddress;"
      );
      expect(config).toContain(
        "command: isCI ? 'npx nx run myapp:preview' : 'npx nx run myapp:serve',"
      );
      expect(config).toContain('url: webServerAddress,');
    });

    it('should default the CI address to the local one', async () => {
      await configGenerator(tree, {
        project: 'myapp-e2e',
        webServerCommand: 'npx nx run myapp:serve',
        webServerAddress: 'http://localhost:4200',
        ciWebServerCommand: 'npx nx run myapp:serve-static',
      });

      expect(readConfig()).toContain(
        "const webServerAddress = isCI ? 'http://localhost:4200' : 'http://localhost:4200';"
      );
    });

    it('should not switch on CI when the CI web server is the same', async () => {
      await configGenerator(tree, {
        project: 'myapp-e2e',
        webServerCommand: 'npx nx run myapp:serve',
        webServerAddress: 'http://localhost:4200',
        ciWebServerCommand: 'npx nx run myapp:serve',
        ciWebServerAddress: 'http://localhost:4200',
      });

      expect(readConfig()).not.toContain('isCI');
    });
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
            "playwright.config.mts",
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
          "include": ["e2e/**/*.ts", "e2e/**/*.js", "playwright.config.mts"],
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
