import { addProjectConfiguration, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import update from './update-rollup-executor';

describe('Migration: @nrwl/rollup', () => {
  it(`should update usage of rollup executor`, async () => {
    let tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    addProjectConfiguration(tree, 'mylib', {
      root: 'libs/mylib',
      sourceRoot: 'libs/mylib/src',
      projectType: 'library',
      targets: {
        build: {
          executor: '@nrwl/web:rollup',
          options: {},
        },
      },
    });
    await update(tree);

    expect(readProjectConfiguration(tree, 'mylib')).toEqual({
      $schema: '../../node_modules/nx/schemas/project-schema.json',
      name: 'mylib',
      root: 'libs/mylib',
      sourceRoot: 'libs/mylib/src',
      projectType: 'library',
      targets: {
        build: {
          executor: '@nrwl/rollup:rollup',
          options: {},
        },
      },
    });
  });

  it(`should replace umd with cjs`, async () => {
    let tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      sourceRoot: 'libs/lib1/src',
      projectType: 'library',
      targets: {
        build: {
          executor: '@nrwl/web:rollup',
          options: {
            formats: ['umd'],
          },
        },
      },
    });
    addProjectConfiguration(tree, 'lib2', {
      root: 'libs/lib2',
      sourceRoot: 'libs/lib2/src',
      projectType: 'library',
      targets: {
        build: {
          executor: '@nrwl/rollup:rollup',
          options: {
            formats: ['esm', 'cjs', 'umd'],
          },
        },
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'lib1')).toEqual({
      $schema: '../../node_modules/nx/schemas/project-schema.json',
      name: 'lib1',
      root: 'libs/lib1',
      sourceRoot: 'libs/lib1/src',
      projectType: 'library',
      targets: {
        build: {
          executor: '@nrwl/rollup:rollup',
          options: {
            formats: ['cjs'],
          },
        },
      },
    });
    expect(readProjectConfiguration(tree, 'lib2')).toEqual({
      $schema: '../../node_modules/nx/schemas/project-schema.json',
      name: 'lib2',
      root: 'libs/lib2',
      sourceRoot: 'libs/lib2/src',
      projectType: 'library',
      targets: {
        build: {
          executor: '@nrwl/rollup:rollup',
          options: {
            formats: ['esm', 'cjs'],
          },
        },
      },
    });
  });
});
