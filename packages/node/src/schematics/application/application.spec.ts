import { Tree } from '@angular-devkit/schematics';
import * as stripJsonComments from 'strip-json-comments';
import { createEmptyWorkspace, getFileContent } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';
import { NxJson, readJsonInTree } from '@nrwl/workspace';
import { createApp } from '../../../../angular/src/utils/testing';

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
        jasmine.objectContaining({
          build: {
            builder: '@nrwl/node:build',
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
        builder: '@nrwl/linter:lint',
        options: {
          linter: 'eslint',
          tsConfig: [
            'apps/my-node-app/tsconfig.app.json',
            'apps/my-node-app/tsconfig.spec.json',
          ],
          exclude: ['**/node_modules/**', '!apps/my-node-app/**/*'],
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

      expect(tree.readContent('apps/my-node-app/tsconfig.json'))
        .toMatchInlineSnapshot(`
        "{
          \\"extends\\": \\"../../tsconfig.base.json\\",
          \\"files\\": [],
          \\"include\\": [],
          \\"references\\": [
            {
              \\"path\\": \\"./tsconfig.app.json\\"
            },
            {
              \\"path\\": \\"./tsconfig.spec.json\\"
            }
          ]
        }
        "
      `);

      const tsconfigApp = JSON.parse(
        stripJsonComments(
          getFileContent(tree, 'apps/my-node-app/tsconfig.app.json')
        )
      );
      expect(tsconfigApp.compilerOptions.outDir).toEqual('../../dist/out-tsc');
      expect(tsconfigApp.extends).toEqual('./tsconfig.json');

      const eslintrc = JSON.parse(
        stripJsonComments(getFileContent(tree, 'apps/my-node-app/.eslintrc'))
      );
      expect(eslintrc.extends).toEqual('../../.eslintrc');
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
        builder: '@nrwl/linter:lint',
        options: {
          linter: 'eslint',
          tsConfig: [
            'apps/my-dir/my-node-app/tsconfig.app.json',
            'apps/my-dir/my-node-app/tsconfig.spec.json',
          ],
          exclude: ['**/node_modules/**', '!apps/my-dir/my-node-app/**/*'],
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
        const content = getFileContent(tree, path);
        const config = JSON.parse(stripJsonComments(content));

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
          path: 'apps/my-dir/my-node-app/.eslintrc',
          lookupFn: (json) => json.extends,
          expectedValue: '../../../.eslintrc',
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
      expect(
        workspaceJson.projects['my-node-app'].architect.lint.options.tsConfig
      ).toEqual(['apps/my-node-app/tsconfig.app.json']);
    });
  });

  describe('frontendProject', () => {
    it('should configure proxy', async () => {
      appTree = createApp(appTree, 'my-frontend');

      const tree = await runSchematic(
        'app',
        { name: 'myNodeApp', frontendProject: 'my-frontend' },
        appTree
      );

      expect(tree.exists('apps/my-frontend/proxy.conf.json')).toBeTruthy();
      const serve = JSON.parse(tree.readContent('workspace.json')).projects[
        'my-frontend'
      ].architect.serve;
      expect(serve.options.proxyConfig).toEqual(
        'apps/my-frontend/proxy.conf.json'
      );
    });

    it('should work with unnormalized project names', async () => {
      appTree = createApp(appTree, 'myFrontend');

      const tree = await runSchematic(
        'app',
        { name: 'myNodeApp', frontendProject: 'myFrontend' },
        appTree
      );

      expect(tree.exists('apps/my-frontend/proxy.conf.json')).toBeTruthy();
      const serve = JSON.parse(tree.readContent('workspace.json')).projects[
        'my-frontend'
      ].architect.serve;
      expect(serve.options.proxyConfig).toEqual(
        'apps/my-frontend/proxy.conf.json'
      );
    });
  });
});
