import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import subject from './remove-deprecated-options-13-0-0';

describe('Migration: Remove deprecated options', () => {
  it(`should remove deprecated web build options`, async () => {
    let tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    addProjectConfiguration(tree, 'myapp', {
      root: 'apps/myapp',
      sourceRoot: 'apps/myapp/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nrwl/web:build',
          options: {
            showCircularDependencies: false,
            budgets: [],
          },
          configurations: {
            production: {
              showCircularDependencies: true,
              budgets: [],
            },
          },
        },
      },
    });

    await subject(tree);

    expect(readProjectConfiguration(tree, 'myapp')).toEqual({
      $schema: '../../node_modules/nx/schemas/project-schema.json',
      name: 'myapp',
      root: 'apps/myapp',
      sourceRoot: 'apps/myapp/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nrwl/web:build',
          options: {},
          configurations: {
            production: {},
          },
        },
      },
    });
  });
});
