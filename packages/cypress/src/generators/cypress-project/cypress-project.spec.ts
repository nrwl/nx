import { readJson, readProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { cypressProjectGenerator } from './cypress-project';
import { Schema } from './schema';
import { Linter } from '@nrwl/linter';

describe('schematic:cypress-project', () => {
  let tree: Tree;
  const defaultOptions: Omit<Schema, 'name' | 'project'> = {
    linter: Linter.EsLint,
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('Cypress Project', () => {
    it('should generate files', async () => {
      await cypressProjectGenerator(tree, {
        ...defaultOptions,
        name: 'my-app-e2e',
        project: 'my-app',
      });

      expect(tree.exists('apps/my-app-e2e/cypress.json')).toBeTruthy();
      expect(tree.exists('apps/my-app-e2e/tsconfig.e2e.json')).toBeTruthy();

      expect(
        tree.exists('apps/my-app-e2e/src/fixtures/example.json')
      ).toBeTruthy();
      expect(
        tree.exists('apps/my-app-e2e/src/integration/app.spec.ts')
      ).toBeTruthy();
      expect(tree.exists('apps/my-app-e2e/src/plugins/index.js')).toBeTruthy();
      expect(tree.exists('apps/my-app-e2e/src/support/app.po.ts')).toBeTruthy();
      expect(
        tree.exists('apps/my-app-e2e/src/support/commands.ts')
      ).toBeTruthy();
      expect(tree.exists('apps/my-app-e2e/src/support/index.ts')).toBeTruthy();
    });

    it('should add update `workspace.json` file', async () => {
      await cypressProjectGenerator(tree, {
        name: 'my-app-e2e',
        project: 'my-app',
        linter: Linter.TsLint,
      });
      const workspaceJson = readJson(tree, 'workspace.json');
      const project = workspaceJson.projects['my-app-e2e'];

      expect(project.root).toEqual('apps/my-app-e2e');

      expect(project.architect.lint).toEqual({
        builder: '@angular-devkit/build-angular:tslint',
        options: {
          tsConfig: ['apps/my-app-e2e/tsconfig.e2e.json'],
          exclude: ['**/node_modules/**', '!apps/my-app-e2e/**/*'],
        },
      });
      expect(project.architect.e2e).toEqual({
        builder: '@nrwl/cypress:cypress',
        options: {
          cypressConfig: 'apps/my-app-e2e/cypress.json',
          devServerTarget: 'my-app:serve',
          tsConfig: 'apps/my-app-e2e/tsconfig.e2e.json',
        },
        configurations: {
          production: {
            devServerTarget: 'my-app:serve:production',
          },
        },
      });
    });

    it('should add update `workspace.json` file properly when eslint is passed', async () => {
      await cypressProjectGenerator(tree, {
        name: 'my-app-e2e',
        project: 'my-app',
        linter: Linter.EsLint,
      });
      const workspaceJson = readJson(tree, 'workspace.json');
      const project = workspaceJson.projects['my-app-e2e'];

      expect(project.architect.lint).toEqual({
        builder: '@nrwl/linter:eslint',
        options: {
          lintFilePatterns: ['apps/my-app-e2e/**/*.{js,ts}'],
        },
      });
    });

    it('should update nx.json', async () => {
      await cypressProjectGenerator(tree, {
        name: 'my-app-e2e',
        project: 'my-app',
        linter: Linter.EsLint,
      });

      const project = readProjectConfiguration(tree, 'my-app-e2e');
      expect(project.tags).toEqual([]);
      expect(project.implicitDependencies).toEqual(['my-app']);
    });

    it('should set right path names in `cypress.json`', async () => {
      await cypressProjectGenerator(tree, {
        ...defaultOptions,
        name: 'my-app-e2e',
        project: 'my-app',
      });
      const cypressJson = readJson(tree, 'apps/my-app-e2e/cypress.json');

      expect(cypressJson).toEqual({
        fileServerFolder: '.',
        fixturesFolder: './src/fixtures',
        integrationFolder: './src/integration',
        modifyObstructiveCode: false,
        pluginsFile: './src/plugins/index',
        supportFile: './src/support/index.ts',
        video: true,
        videosFolder: '../../dist/cypress/apps/my-app-e2e/videos',
        screenshotsFolder: '../../dist/cypress/apps/my-app-e2e/screenshots',
        chromeWebSecurity: false,
      });
    });

    it('should set right path names in `tsconfig.e2e.json`', async () => {
      await cypressProjectGenerator(tree, {
        ...defaultOptions,
        name: 'my-app-e2e',
        project: 'my-app',
      });
      const tsconfigJson = readJson(tree, 'apps/my-app-e2e/tsconfig.e2e.json');

      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
      expect(tsconfigJson.compilerOptions.outDir).toEqual('../../dist/out-tsc');
    });

    describe('nested', () => {
      it('should update workspace.json', async () => {
        await cypressProjectGenerator(tree, {
          name: 'my-app-e2e',
          project: 'my-dir-my-app',
          directory: 'my-dir',
          linter: Linter.TsLint,
        });
        const projectConfig = readJson(tree, 'workspace.json').projects[
          'my-dir-my-app-e2e'
        ];

        expect(projectConfig).toBeDefined();
        expect(projectConfig.architect.lint).toEqual({
          builder: '@angular-devkit/build-angular:tslint',
          options: {
            tsConfig: ['apps/my-dir/my-app-e2e/tsconfig.e2e.json'],
            exclude: ['**/node_modules/**', '!apps/my-dir/my-app-e2e/**/*'],
          },
        });

        expect(projectConfig.architect.e2e).toEqual({
          builder: '@nrwl/cypress:cypress',
          options: {
            cypressConfig: 'apps/my-dir/my-app-e2e/cypress.json',
            devServerTarget: 'my-dir-my-app:serve',
            tsConfig: 'apps/my-dir/my-app-e2e/tsconfig.e2e.json',
          },
          configurations: {
            production: {
              devServerTarget: 'my-dir-my-app:serve:production',
            },
          },
        });
      });

      it('should set right path names in `cypress.json`', async () => {
        await cypressProjectGenerator(tree, {
          ...defaultOptions,
          name: 'my-app-e2e',
          project: 'my-dir-my-app',
          directory: 'my-dir',
        });
        const cypressJson = readJson(
          tree,
          'apps/my-dir/my-app-e2e/cypress.json'
        );

        expect(cypressJson).toEqual({
          fileServerFolder: '.',
          fixturesFolder: './src/fixtures',
          integrationFolder: './src/integration',
          modifyObstructiveCode: false,
          pluginsFile: './src/plugins/index',
          supportFile: './src/support/index.ts',
          video: true,
          videosFolder: '../../../dist/cypress/apps/my-dir/my-app-e2e/videos',
          screenshotsFolder:
            '../../../dist/cypress/apps/my-dir/my-app-e2e/screenshots',
          chromeWebSecurity: false,
        });
      });

      it('should set right path names in `tsconfig.e2e.json`', async () => {
        await cypressProjectGenerator(tree, {
          ...defaultOptions,
          name: 'my-app-e2e',
          project: 'my-dir-my-app',
          directory: 'my-dir',
        });
        const tsconfigJson = readJson(
          tree,
          'apps/my-dir/my-app-e2e/tsconfig.e2e.json'
        );

        expect(tsconfigJson.compilerOptions.outDir).toEqual(
          '../../../dist/out-tsc'
        );
      });
    });

    describe('--project', () => {
      describe('none', () => {
        it('should not add any implicit dependencies', async () => {
          await cypressProjectGenerator(tree, {
            ...defaultOptions,
            name: 'my-app-e2e',
          });

          const nxJson = readJson(tree, 'nx.json');
          expect(nxJson.projects['my-app-e2e']).toEqual({ tags: [] });
        });
      });
    });

    describe('--linter', () => {
      describe('eslint', () => {
        it('should add eslint-plugin-cypress', async () => {
          await cypressProjectGenerator(tree, {
            name: 'my-app-e2e',
            project: 'my-app',
            linter: Linter.EsLint,
          });
          const packageJson = readJson(tree, 'package.json');
          expect(
            packageJson.devDependencies['eslint-plugin-cypress']
          ).toBeTruthy();

          const eslintrcJson = readJson(tree, 'apps/my-app-e2e/.eslintrc.json');
          expect(eslintrcJson).toMatchInlineSnapshot(`
            Object {
              "extends": Array [
                "plugin:cypress/recommended",
                "../../.eslintrc.json",
              ],
              "ignorePatterns": Array [
                "!**/*",
              ],
              "overrides": Array [
                Object {
                  "files": Array [
                    "*.ts",
                    "*.tsx",
                    "*.js",
                    "*.jsx",
                  ],
                  "parserOptions": Object {
                    "project": "apps/my-app-e2e/tsconfig.*?.json",
                  },
                  "rules": Object {},
                },
                Object {
                  "files": Array [
                    "src/plugins/index.js",
                  ],
                  "rules": Object {
                    "@typescript-eslint/no-var-requires": "off",
                    "no-undef": "off",
                  },
                },
              ],
            }
          `);
        });
      });
    });
  });
});
