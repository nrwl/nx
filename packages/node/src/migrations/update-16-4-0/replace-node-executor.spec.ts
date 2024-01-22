import { addProjectConfiguration, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './replace-node-executor';

describe('Migration: replace @nx/node:node executor', () => {
  it(`should replace @nx/node:node executor with @nx/js:node`, async () => {
    let tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    addProjectConfiguration(tree, 'myapp', {
      root: 'apps/myapp',
      sourceRoot: 'apps/myapp/src',
      projectType: 'application',
      targets: {
        foo: {
          executor: '@nx/node:node',
          options: {},
        },
        bar: {
          executor: '@nx/node:node',
          options: {},
        },
      },
    });

    addProjectConfiguration(tree, 'myapp2', {
      root: 'apps/myapp2',
      sourceRoot: 'apps/myapp2/src',
      projectType: 'application',
      targets: {
        foo: {
          executor: '@nx/node:node',
          options: {},
        },
        bar: {
          executor: '@nx/node:node',
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
          executor: '@nx/js:node',
          options: {},
        },
        bar: {
          executor: '@nx/js:node',
          options: {},
        },
      },
    });

    expect(readProjectConfiguration(tree, 'myapp2')).toEqual({
      $schema: '../../node_modules/nx/schemas/project-schema.json',
      name: 'myapp2',
      root: 'apps/myapp2',
      sourceRoot: 'apps/myapp2/src',
      projectType: 'application',
      targets: {
        foo: {
          executor: '@nx/js:node',
          options: {},
        },
        bar: {
          executor: '@nx/js:node',
          options: {},
        },
      },
    });
  });
});
