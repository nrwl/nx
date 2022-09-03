import { Tree, readJson } from '@nrwl/devkit';
import { createTreeWithEmptyV1Workspace } from '@nrwl/devkit/testing';

import { applicationGenerator } from '../application/application';
import { customServerGenerator } from './custom-server';

describe('custom-server', () => {
  let tree: Tree;
  const appName = 'my-app';

  beforeEach(async () => {
    tree = createTreeWithEmptyV1Workspace();
    await applicationGenerator(tree, {
      name: appName,
      style: 'css',
      standaloneConfig: false,
    });
  });

  it('should generate custom server for application', async () => {
    await customServerGenerator(tree, { project: appName });

    expect(tree.exists('apps/my-app/tsconfig.server.json')).toBeTruthy();
    expect(tree.exists('apps/my-app/server/main.ts')).toBeTruthy();

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toMatchObject({
      devDependencies: {
        '@nrwl/devkit': expect.anything(),
      },
    });

    const nxJson = readJson(tree, 'nx.json');
    expect(
      nxJson.tasksRunnerOptions.default.options.cacheableOperations
    ).toContain('build-custom-server');

    const workspaceJson = readJson(tree, 'workspace.json');
    const architectConfig = workspaceJson.projects['my-app'].architect;
    expect(architectConfig['build-custom-server']).toMatchInlineSnapshot(`
      Object {
        "builder": "@nrwl/js:tsc",
        "configurations": Object {
          "development": Object {},
          "production": Object {},
        },
        "defaultConfiguration": "production",
        "options": Object {
          "assets": Array [],
          "clean": false,
          "main": "apps/my-app/server/main.ts",
          "outputPath": "dist/apps/my-app",
          "tsConfig": "apps/my-app/tsconfig.server.json",
        },
      }
    `);
    expect(architectConfig['serve-custom-server']).toMatchInlineSnapshot(`
      Object {
        "builder": "@nrwl/js:node",
        "configurations": Object {
          "development": Object {
            "buildTarget": "my-app:build-custom-server:development",
          },
          "production": Object {
            "buildTarget": "my-app:build-custom-server:production",
          },
        },
        "defaultConfiguration": "development",
        "options": Object {
          "buildTarget": "my-app:build-custom-server",
        },
      }
    `);
  });
});
