import { readJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import update from './update-package-to-tsc';

describe('Migration: rename package to tsc', () => {
  it(`should rename the "package" executor to "tsc"`, async () => {
    let tree = createTreeWithEmptyWorkspace();

    tree.write(
      'workspace.json',
      JSON.stringify({
        version: 2,
        projects: {
          mylib: {
            root: 'libs/mylib',
            sourceRoot: 'libs/mylib/src',
            projectType: 'library',
            targets: {
              build: {
                executor: '@nrwl/node:package',
                options: {
                  tsPlugins: [],
                },
              },
            },
          },
        },
      })
    );

    const tasks = await update(tree);

    expect(tasks).toBeDefined();
    expect(readJson(tree, 'workspace.json')).toEqual({
      version: 2,
      projects: {
        mylib: {
          root: 'libs/mylib',
          sourceRoot: 'libs/mylib/src',
          projectType: 'library',
          targets: {
            build: {
              executor: '@nrwl/js:tsc',
              options: {
                transformers: [],
              },
            },
          },
        },
      },
    });
  });

  it(`should skip migration if no projects use @nrwl/js:node`, async () => {
    let tree = createTreeWithEmptyWorkspace();

    tree.write(
      'workspace.json',
      JSON.stringify({
        version: 2,
        projects: {},
      })
    );

    const tasks = await update(tree);

    expect(tasks).toBeUndefined();
  });
});
