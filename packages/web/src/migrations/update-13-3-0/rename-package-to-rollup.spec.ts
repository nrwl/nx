import { readJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import renamePackageToRollup from './rename-package-to-rollup';

describe('Migration: rename package to rollup', () => {
  it(`should rename the "package" executor to "rollup"`, async () => {
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
                executor: '@nrwl/web:package',
                options: {},
              },
            },
          },
        },
      })
    );

    await renamePackageToRollup(tree);

    expect(readJson(tree, 'workspace.json')).toEqual({
      version: 2,
      projects: {
        myapp: {
          root: 'apps/myapp',
          sourceRoot: 'apps/myapp/src',
          projectType: 'application',
          targets: {
            build: {
              executor: '@nrwl/web:rollup',
              options: {},
            },
          },
        },
      },
    });
  });
});
