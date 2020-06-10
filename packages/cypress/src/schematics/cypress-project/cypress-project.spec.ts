import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';
import { readJsonInTree, Linter, NxJson } from '@nrwl/workspace';

describe('schematic:cypress-project', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
  });

  describe('Cypress Project', () => {
    it('should generate files', async () => {
      const tree = await runSchematic(
        'cypress-project',
        { name: 'my-app-e2e', project: 'my-app' },
        appTree
      );

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
      const tree = await runSchematic(
        'cypress-project',
        { name: 'my-app-e2e', project: 'my-app', linter: Linter.TsLint },
        appTree
      );
      const workspaceJson = readJsonInTree(tree, 'workspace.json');
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
      const tree = await runSchematic(
        'cypress-project',
        { name: 'my-app-e2e', project: 'my-app', linter: Linter.EsLint },
        appTree
      );
      const workspaceJson = readJsonInTree(tree, 'workspace.json');
      const project = workspaceJson.projects['my-app-e2e'];

      expect(project.architect.lint).toEqual({
        builder: '@nrwl/linter:lint',
        options: {
          linter: 'eslint',
          tsConfig: ['apps/my-app-e2e/tsconfig.e2e.json'],
          exclude: ['**/node_modules/**', '!apps/my-app-e2e/**/*'],
        },
      });
    });

    it('should update nx.json', async () => {
      const tree = await runSchematic(
        'cypress-project',
        { name: 'my-app-e2e', project: 'my-app', linter: Linter.EsLint },
        appTree
      );

      const nxJson = readJsonInTree<NxJson>(tree, 'nx.json');
      expect(nxJson.projects['my-app-e2e']).toEqual({
        tags: [],
        implicitDependencies: ['my-app'],
      });
    });

    it('should set right path names in `cypress.json`', async () => {
      const tree = await runSchematic(
        'cypress-project',
        { name: 'my-app-e2e', project: 'my-app' },
        appTree
      );
      const cypressJson = readJsonInTree(tree, 'apps/my-app-e2e/cypress.json');

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
      const tree = await runSchematic(
        'cypress-project',
        { name: 'my-app-e2e', project: 'my-app' },
        appTree
      );
      const tsconfigJson = readJsonInTree(
        tree,
        'apps/my-app-e2e/tsconfig.e2e.json'
      );

      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
      expect(tsconfigJson.compilerOptions.outDir).toEqual('../../dist/out-tsc');
    });

    describe('nested', () => {
      it('should update workspace.json', async () => {
        const tree = await runSchematic(
          'cypress-project',
          {
            name: 'my-app-e2e',
            project: 'my-dir-my-app',
            directory: 'my-dir',
            linter: Linter.TsLint,
          },
          appTree
        );
        const projectConfig = readJsonInTree(tree, 'workspace.json').projects[
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
        const tree = await runSchematic(
          'cypress-project',
          { name: 'my-app-e2e', project: 'my-dir-my-app', directory: 'my-dir' },
          appTree
        );
        const cypressJson = readJsonInTree(
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
        const tree = await runSchematic(
          'cypress-project',
          { name: 'my-app-e2e', project: 'my-dir-my-app', directory: 'my-dir' },
          appTree
        );
        const tsconfigJson = readJsonInTree(
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
          const tree = await runSchematic(
            'cypress-project',
            { name: 'my-app-e2e' },
            appTree
          );

          const nxJson = readJsonInTree(tree, 'nx.json');
          expect(nxJson.projects['my-app-e2e']).toEqual({ tags: [] });
        });
      });
    });

    describe('--linter', () => {
      describe('eslint', () => {
        it('should add eslint-plugin-cypress', async () => {
          const tree = await runSchematic(
            'cypress-project',
            { name: 'my-app-e2e', project: 'my-app', linter: Linter.EsLint },
            appTree
          );
          const packageJson = readJsonInTree(tree, 'package.json');
          const eslintrcJson = readJsonInTree(
            tree,
            'apps/my-app-e2e/.eslintrc'
          );

          expect(
            packageJson.devDependencies['eslint-plugin-cypress']
          ).toBeTruthy();
          expect(eslintrcJson.extends).toContain('plugin:cypress/recommended');
        });
      });
    });
  });
});
