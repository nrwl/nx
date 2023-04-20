import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import update from './update-webpack-executor';

describe('Migration: @nx/webpack', () => {
  it(`should update usage of webpack executor`, async () => {
    let tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    addProjectConfiguration(tree, 'myapp', {
      root: 'apps/myapp',
      sourceRoot: 'apps/myapp/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nx/web:webpack',
          options: {},
        },
        serve: {
          executor: '@nx/web:dev-server',
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
        build: {
          executor: '@nx/webpack:webpack',
          options: {},
        },
        serve: {
          executor: '@nx/webpack:dev-server',
          options: {},
        },
      },
    });
  });
});
