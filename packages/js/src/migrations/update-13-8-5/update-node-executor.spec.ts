import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import update from './update-node-executor';

describe('Migration: rename execute to node', () => {
  it(`should rename the "execute" executor to "node"`, async () => {
    let tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    addProjectConfiguration(tree, 'myapp', {
      root: 'apps/myapp',
      sourceRoot: 'apps/myapp/src',
      projectType: 'application',
      targets: {
        serve: {
          executor: '@nrwl/js:node',
          options: {},
        },
      },
    });

    const tasks = await update(tree);

    expect(tasks).toBeDefined();
    expect(readProjectConfiguration(tree, 'myapp')).toEqual({
      $schema: '../../node_modules/nx/schemas/project-schema.json',
      name: 'myapp',
      root: 'apps/myapp',
      sourceRoot: 'apps/myapp/src',
      projectType: 'application',
      targets: {
        serve: {
          executor: '@nrwl/node:node',
          options: {},
        },
      },
    });
  });

  it(`should skip migration if no projects use @nrwl/js:node`, async () => {
    let tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

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
