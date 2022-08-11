import { readJson } from '@nrwl/devkit';
import { createTreeWithEmptyV1Workspace } from '@nrwl/devkit/testing';

import rename from './rename-execute-to-node';

describe('Migration: rename execute to node', () => {
  it(`should rename the "execute" executor to "node"`, async () => {
    let tree = createTreeWithEmptyV1Workspace();

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
              serve: {
                executor: '@nrwl/node:execute',
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
            serve: {
              executor: '@nrwl/node:node',
              options: {},
            },
          },
        },
      },
    });
  });
});
