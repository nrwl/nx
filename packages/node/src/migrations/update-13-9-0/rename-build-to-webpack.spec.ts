import { readJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import rename from './rename-build-to-webpack';

describe('Migration: rename build to webpack', () => {
  it(`should rename the "build" executor to "webpack"`, async () => {
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
                executor: '@nrwl/node:build',
                options: {},
              },
            },
          },
        },
      })
    );

    await rename(tree);

    expect(readJson(tree, 'workspace.json')).toEqual({
      version: 2,
      projects: {
        myapp: {
          root: 'apps/myapp',
          sourceRoot: 'apps/myapp/src',
          projectType: 'application',
          targets: {
            build: {
              executor: '@nrwl/node:webpack',
              options: {},
            },
          },
        },
      },
    });
  });
});
