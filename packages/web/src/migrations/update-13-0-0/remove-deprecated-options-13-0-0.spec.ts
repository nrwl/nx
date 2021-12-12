import { readJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import subject from './remove-deprecated-options-13-0-0';

describe('Migration: Remove deprecated options', () => {
  it(`should remove deprecated web build options`, async () => {
    let tree = createTreeWithEmptyWorkspace();

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
          },
        },
      })
    );

    await subject(tree);

    expect(readJson(tree, 'workspace.json')).toEqual({
      version: 2,
      projects: {
        myapp: {
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
        },
      },
    });
  });
});
