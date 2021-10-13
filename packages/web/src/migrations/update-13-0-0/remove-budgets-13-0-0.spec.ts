import { readJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import subject from './remove-budgets-13-0-0';

describe('Migration: node-sass to sass', () => {
  it(`should remove node-sass if present in devDependencies or dependencies`, async () => {
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
                  budgets: [],
                },
                configurations: {
                  production: {
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
