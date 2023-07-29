import { addProjectConfiguration, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import update from './update-webpack-executor';

describe('Migration: @nrwl/webpack', () => {
  it(`should update usage of webpack executor`, async () => {
    let tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    addProjectConfiguration(tree, 'myapp', {
      root: 'apps/myapp',
      sourceRoot: 'apps/myapp/src',
      projectType: 'application',
      targets: {
        foo: {
          executor: '@nrwl/node:webpack',
          options: {},
        },
        bar: {
          executor: '@nx/node:webpack',
          options: {},
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'myapp')).toEqual({
      $schema: '../../node_modules/nx/schemas/project-schema.json',
      name: 'myapp',
      root: 'apps/myapp',
      sourceRoot: 'apps/myapp/src',
      projectType: 'application',
      targets: {
        foo: {
          executor: '@nx/webpack:webpack',
          options: {
            compiler: 'tsc',
            target: 'node',
          },
        },
        bar: {
          executor: '@nx/webpack:webpack',
          options: {
            compiler: 'tsc',
            target: 'node',
          },
        },
      },
    });
  });
});
