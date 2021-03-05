import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';
import { NxJson, readJsonInTree } from '@nrwl/workspace';
// to break the dependency
const createApp = require('../../../../angular/' + 'src/utils/testing')
  .createApp;

import { Schema } from './schema';

describe('app', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
  });

  describe('not nested', () => {
    it('should update workspace.json', async () => {
      const tree = await runSchematic('app', { name: 'myNodeApp' }, appTree);
      const workspaceJson = readJsonInTree(tree, '/workspace.json');
      const project = workspaceJson.projects['my-node-app'];
      expect(project.root).toEqual('apps/my-node-app');
      expect(project.architect).toEqual(
        expect.objectContaining({
          build: {
            builder: '@nrwl/node:build',
            outputs: ['{options.outputPath}'],
            options: {
              outputPath: 'dist/apps/my-node-app',
              main: 'apps/my-node-app/src/main.ts',
              tsConfig: 'apps/my-node-app/tsconfig.app.json',
              assets: ['apps/my-node-app/src/assets'],
            },
            configurations: {
              production: {
                optimization: true,
                extractLicenses: true,
                inspect: false,
                fileReplacements: [
                  {
                    replace: 'apps/my-node-app/src/environments/environment.ts',
                    with:
                      'apps/my-node-app/src/environments/environment.prod.ts',
                  },
                ],
              },
            },
          },
          serve: {
            builder: '@nrwl/node:execute',
            options: {
              buildTarget: 'my-node-app:build',
            },
          },
        })
      );
      expect(workspaceJson.projects['my-node-app'].architect.lint).toEqual({
        builder: '@nrwl/linter:eslint',
        options: {
          lintFilePatterns: ['apps/my-node-app/**/*.ts'],
        },
      });
      expect(workspaceJson.projects['my-node-app-e2e']).toBeUndefined();
      expect(workspaceJson.defaultProject).toEqual('my-node-app');
    });

    it('should update nx.json', async () => {
      const tree = await runSchematic(
        'app',
        { name: 'myNodeApp', tags: 'one,two' },
        appTree
      );
      const nxJson = readJsonInTree<NxJson>(tree, '/nx.json');
      expect(nxJson.projects).toEqual({
        'my-node-app': {
          tags: ['one', 'two'],
        },
      });
    });

    it('should generate files', async () => {
      const tree = await runSchematic('app', { name: 'myNodeApp' }, appTree);
      expect(tree.exists(`apps/my-node-app/jest.config.js`)).toBeTruthy();
      expect(tree.exists('apps/my-node-app/src/main.ts')).toBeTruthy();

      const tsconfig = readJsonInTree(tree, 'apps/my-node-app/tsconfig.json');
      expect(tsconfig).toMatchInlineSnapshot(`
        Object {
          "extends": "../../tsconfig.base.json",
          "files": Array [],
          "include": Array [],
          "references": Array [
            Object {
              "path": "./tsconfig.app.json",
            },
            Object {
              "path": "./tsconfig.spec.json",
            },
          ],
        }
      `);

      const tsconfigApp = readJsonInTree(
        tree,
        'apps/my-node-app/tsconfig.app.json'
      );
      expect(tsconfigApp.compilerOptions.outDir).toEqual('../../dist/out-tsc');
      expect(tsconfigApp.extends).toEqual('./tsconfig.json');

      const eslintrc = readJsonInTree(tree, 'apps/my-node-app/.eslintrc.json');
      expect(eslintrc.extends).toEqual('../../.eslintrc.json');
    });
  });

  describe('nested', () => {
    it('should update workspace.json', async () => {
      const tree = await runSchematic(
        'app',
        { name: 'myNodeApp', directory: 'myDir' },
        appTree
      );
      const workspaceJson = readJsonInTree(tree, '/workspace.json');

      expect(workspaceJson.projects['my-dir-my-node-app'].root).toEqual(
        'apps/my-dir/my-node-app'
      );

      expect(
        workspaceJson.projects['my-dir-my-node-app'].architect.lint
      ).toEqual({
        builder: '@nrwl/linter:eslint',
        options: {
          lintFilePatterns: ['apps/my-dir/my-node-app/**/*.ts'],
        },
      });

      expect(workspaceJson.projects['my-dir-my-node-app-e2e']).toBeUndefined();
      expect(workspaceJson.defaultProject).toEqual('my-dir-my-node-app');
    });

    it('should update nx.json', async () => {
      const tree = await runSchematic(
        'app',
        { name: 'myNodeApp', directory: 'myDir', tags: 'one,two' },
        appTree
      );
      const nxJson = readJsonInTree<NxJson>(tree, '/nx.json');
      expect(nxJson.projects).toEqual({
        'my-dir-my-node-app': {
          tags: ['one', 'two'],
        },
      });
    });

    it('should generate files', async () => {
      const hasJsonValue = ({ path, expectedValue, lookupFn }) => {
        const config = readJsonInTree(tree, path);

        expect(lookupFn(config)).toEqual(expectedValue);
      };
      const tree = await runSchematic(
        'app',
        { name: 'myNodeApp', directory: 'myDir' },
        appTree
      );

      // Make sure these exist
      [
        `apps/my-dir/my-node-app/jest.config.js`,
        'apps/my-dir/my-node-app/src/main.ts',
      ].forEach((path) => {
        expect(tree.exists(path)).toBeTruthy();
      });

      // Make sure these have properties
      [
        {
          path: 'apps/my-dir/my-node-app/tsconfig.app.json',
          lookupFn: (json) => json.compilerOptions.outDir,
          expectedValue: '../../../dist/out-tsc',
        },
        {
          path: 'apps/my-dir/my-node-app/tsconfig.app.json',
          lookupFn: (json) => json.compilerOptions.types,
          expectedValue: ['node'],
        },
        {
          path: 'apps/my-dir/my-node-app/.eslintrc.json',
          lookupFn: (json) => json.extends,
          expectedValue: '../../../.eslintrc.json',
        },
      ].forEach(hasJsonValue);
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      const tree = await runSchematic(
        'app',
        { name: 'myNodeApp', unitTestRunner: 'none' },
        appTree
      );
      expect(tree.exists('jest.config.js')).toBeFalsy();
      expect(tree.exists('apps/my-node-app/src/test-setup.ts')).toBeFalsy();
      expect(tree.exists('apps/my-node-app/src/test.ts')).toBeFalsy();
      expect(tree.exists('apps/my-node-app/tsconfig.spec.json')).toBeFalsy();
      expect(tree.exists('apps/my-node-app/jest.config.js')).toBeFalsy();
      const workspaceJson = readJsonInTree(tree, 'workspace.json');
      expect(
        workspaceJson.projects['my-node-app'].architect.test
      ).toBeUndefined();
      expect(workspaceJson.projects['my-node-app'].architect.lint)
        .toMatchInlineSnapshot(`
        Object {
          "builder": "@nrwl/linter:eslint",
          "options": Object {
            "lintFilePatterns": Array [
              "apps/my-node-app/**/*.ts",
            ],
          },
        }
      `);
    });
  });

  describe('--frontendProject', () => {
    it('should configure proxy', async () => {
      appTree = createApp(appTree, 'my-frontend');

      const tree = await runSchematic(
        'app',
        { name: 'myNodeApp', frontendProject: 'my-frontend' },
        appTree
      );

      expect(tree.exists('apps/my-frontend/proxy.conf.json')).toBeTruthy();
      const serve = readJsonInTree(tree, 'workspace.json').projects[
        'my-frontend'
      ].architect.serve;
      expect(serve.options.proxyConfig).toEqual(
        'apps/my-frontend/proxy.conf.json'
      );
    });

    it('should configure proxies for multiple node projects with the same frontend app', async () => {
      appTree = createApp(appTree, 'my-frontend');

      appTree = await runSchematic(
        'app',
        { name: 'cart', frontendProject: 'my-frontend' },
        appTree
      );

      const tree = await runSchematic(
        'app',
        { name: 'billing', frontendProject: 'my-frontend' },
        appTree
      );

      expect(tree.exists('apps/my-frontend/proxy.conf.json')).toBeTruthy();

      expect(readJsonInTree(tree, 'apps/my-frontend/proxy.conf.json')).toEqual({
        '/api': { target: 'http://localhost:3333', secure: false },
        '/billing-api': { target: 'http://localhost:3333', secure: false },
      });
    });

    it('should work with unnormalized project names', async () => {
      appTree = createApp(appTree, 'myFrontend');

      const tree = await runSchematic(
        'app',
        { name: 'myNodeApp', frontendProject: 'myFrontend' },
        appTree
      );

      expect(tree.exists('apps/my-frontend/proxy.conf.json')).toBeTruthy();
      const serve = readJsonInTree(tree, 'workspace.json').projects[
        'my-frontend'
      ].architect.serve;
      expect(serve.options.proxyConfig).toEqual(
        'apps/my-frontend/proxy.conf.json'
      );
    });
  });

  describe('--babelJest', () => {
    it('should use babel for jest', async () => {
      const tree = await runSchematic(
        'app',
        { name: 'myNodeApp', tags: 'one,two', babelJest: true } as Schema,
        appTree
      );

      expect(tree.readContent(`apps/my-node-app/jest.config.js`))
        .toMatchInlineSnapshot(`
        "module.exports = {
          displayName: 'my-node-app',
          preset: '../../jest.preset.js',
          transform: {
            '^.+\\\\\\\\.[tj]s$': ['babel-jest', { cwd: __dirname }],
          },
          moduleFileExtensions: ['ts', 'js', 'html'],
          coverageDirectory: '../../coverage/apps/my-node-app',
        };
        "
      `);
    });
  });
  describe('--js flag', () => {
    it('should generate js files instead of ts files', async () => {
      const tree = await runSchematic(
        'app',
        {
          name: 'myNodeApp',
          js: true,
        } as Schema,
        appTree
      );

      expect(tree.exists(`apps/my-node-app/jest.config.js`)).toBeTruthy();
      expect(tree.exists('apps/my-node-app/src/main.js')).toBeTruthy();

      const tsConfig = readJsonInTree(tree, 'apps/my-node-app/tsconfig.json');
      expect(tsConfig.compilerOptions).toEqual({
        allowJs: true,
      });

      const tsConfigApp = readJsonInTree(
        tree,
        'apps/my-node-app/tsconfig.app.json'
      );
      expect(tsConfigApp.include).toEqual(['**/*.ts', '**/*.js']);
      expect(tsConfigApp.exclude).toEqual(['**/*.spec.ts', '**/*.spec.js']);
    });

    it('should update workspace.json', async () => {
      const tree = await runSchematic(
        'app',
        { name: 'myNodeApp', js: true } as Schema,
        appTree
      );
      const workspaceJson = readJsonInTree(tree, '/workspace.json');
      const project = workspaceJson.projects['my-node-app'];
      const buildTarget = project.architect.build;

      expect(buildTarget.options.main).toEqual('apps/my-node-app/src/main.js');
      expect(buildTarget.configurations.production.fileReplacements).toEqual([
        {
          replace: 'apps/my-node-app/src/environments/environment.js',
          with: 'apps/my-node-app/src/environments/environment.prod.js',
        },
      ]);
    });

    it('should generate js files for nested libs as well', async () => {
      const tree = await runSchematic(
        'app',
        { name: 'myNodeApp', directory: 'myDir', js: true } as Schema,
        appTree
      );
      expect(
        tree.exists(`apps/my-dir/my-node-app/jest.config.js`)
      ).toBeTruthy();
      expect(tree.exists('apps/my-dir/my-node-app/src/main.js')).toBeTruthy();
    });
  });

  describe('--pascalCaseFiles', () => {
    it(`should notify that this flag doesn't do anything`, async () => {
      const tree = await runSchematic(
        'app',
        { name: 'myNodeApp', pascalCaseFiles: true } as Schema,
        appTree
      );

      // @TODO how to spy on context ?
      // expect(contextLoggerSpy).toHaveBeenCalledWith('NOTE: --pascalCaseFiles is a noop')
    });
  });
});
