import { readJson } from '@nrwl/devkit';
import { createTreeWithEmptyV1Workspace } from '@nrwl/devkit/testing';

import update from './update-webpack-executor';

describe('Migration: @nrwl/webpack', () => {
  it(`should update usage of webpack executor`, async () => {
    let tree = createTreeWithEmptyV1Workspace();

    tree.write(
      'workspace.json',
      JSON.stringify({
        version: 2,
        projects: {
          myapp: {
            root: 'apps/myapp',
            sourceRoot: 'apps/myapp/src',
            projectType: 'application',
            targets: {
              build: {
                executor: '@nrwl/web:webpack',
                options: {},
              },
            },
          },
        },
      })
    );

    await update(tree);

    expect(readJson(tree, 'workspace.json')).toEqual({
      version: 2,
      projects: {
        myapp: {
          root: 'apps/myapp',
          sourceRoot: 'apps/myapp/src',
          projectType: 'application',
          targets: {
            build: {
              executor: '@nrwl/webpack:webpack',
              options: {},
            },
          },
        },
      },
    });
  });

  it(`should update usage of dev-server executor`, async () => {
    let tree = createTreeWithEmptyV1Workspace();

    tree.write(
      'workspace.json',
      JSON.stringify({
        version: 2,
        projects: {
          myapp: {
            root: 'apps/myapp',
            sourceRoot: 'apps/myapp/src',
            projectType: 'application',
            targets: {
              serve: {
                executor: '@nrwl/web:dev-server',
                options: {},
              },
            },
          },
        },
      })
    );

    await update(tree);

    expect(readJson(tree, 'workspace.json')).toEqual({
      version: 2,
      projects: {
        myapp: {
          root: 'apps/myapp',
          sourceRoot: 'apps/myapp/src',
          projectType: 'application',
          targets: {
            serve: {
              executor: '@nrwl/webpack:dev-server',
              options: {},
            },
          },
        },
      },
    });
  });
});
