import { addProjectConfiguration, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import update from './update-package-to-tsc';

describe('Migration: rename package to tsc', () => {
  it(`should rename the "package" executor to "tsc"`, async () => {
    let tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    addProjectConfiguration(tree, 'myapp', {
      root: 'apps/myapp',
      sourceRoot: 'apps/myapp/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nrwl/node:package',
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
          executor: '@nrwl/js:tsc',
          options: {},
        },
      },
    });
  });

  it(`should skip migration if no projects use @nrwl/js:node`, async () => {
    let tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    const tasks = await update(tree);

    expect(tasks).toBeUndefined();
  });

  it('should migrate srcRootForCompilationRoot option to rootDir', async () => {
    let tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'myapp', {
      root: 'apps/myapp',
      sourceRoot: 'apps/myapp/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nrwl/node:package',
          options: {
            srcRootForCompilationRoot: '.',
          },
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
          executor: '@nrwl/js:tsc',
          options: {
            rootDir: '.',
          },
        },
      },
    });
  });
});
