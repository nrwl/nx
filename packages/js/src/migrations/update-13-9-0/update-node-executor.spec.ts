import { readJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import update from './update-node-executor';

describe('Migration: rename execute to node', () => {
  it(`should rename the "execute" executor to "node"`, async () => {
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
              serve: {
                executor: '@nrwl/js:node',
                options: {},
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
