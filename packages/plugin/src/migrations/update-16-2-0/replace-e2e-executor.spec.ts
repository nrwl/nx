import {
  Tree,
  readJson,
  updateJson,
  addProjectConfiguration,
  readProjectConfiguration,
} from '@nx/devkit';
import { assertRunsAgainstNxRepo } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import replaceE2EExecutor from './replace-e2e-executor';

describe('update-16-0-0-add-nx-packages', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'proj1', {
      root: 'proj1',
      targets: {
        build: {
          executor: '@nx/js:rollup',
        },
        e2e: {
          executor: '@nx/plugin:e2e',
          options: {
            target: 'proj1:build',
          },
          configurations: {
            ci: {
              ci: true,
            },
          },
        },
      },
    });
  });

  it('should replace @nrwl/nx-plugin:e2e with @nx/jest:jest', async () => {
    await replaceE2EExecutor(tree);

    expect(readProjectConfiguration(tree, 'proj1')).toMatchInlineSnapshot(`
      {
        "$schema": "../node_modules/nx/schemas/project-schema.json",
        "name": "proj1",
        "root": "proj1",
        "targets": {
          "build": {
            "executor": "@nx/js:rollup",
          },
          "e2e": {
            "configurations": {
              "ci": {
                "ci": true,
                "runInBand": true,
              },
            },
            "dependsOn": [
              "proj1:build",
            ],
            "executor": "@nx/jest:jest",
            "options": {
              "runInBand": true,
            },
          },
        },
      }
    `);
  });

  assertRunsAgainstNxRepo(replaceE2EExecutor);
});
