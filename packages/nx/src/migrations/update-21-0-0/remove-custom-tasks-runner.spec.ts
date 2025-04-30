import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';

import update from './remove-custom-tasks-runner';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';

describe('remove custom tasks runners', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should remove all tasks runners that contain a custom runner', async () => {
    updateNxJson(tree, {
      tasksRunnerOptions: {
        default: {
          runner: 'nx-cloud',
          options: {
            cacheableOperations: ['build', 'lint'],
          },
        },
        other: {
          runner: 'some-other-runner',
          options: {
            cacheableOperations: ['test'],
          },
        },
        custom: {
          runner: 'custom-runner',
          options: {
            cacheableOperations: ['build', 'lint'],
          },
        },
      },
    });
    await update(tree);

    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "tasksRunnerOptions": {
          "default": {
            "options": {
              "cacheableOperations": [
                "build",
                "lint",
              ],
            },
            "runner": "nx-cloud",
          },
        },
      }
    `);
  });

  it('should remove whole tasksRunnerOptions if all runners are removed', async () => {
    updateNxJson(tree, {
      tasksRunnerOptions: {
        default: {
          runner: 'custom-runner',
          options: {
            cacheableOperations: ['build', 'lint'],
          },
        },
      },
    });
    await update(tree);
    expect(readNxJson(tree)).toMatchInlineSnapshot(`{}`);
  });

  it('should provide a link to the migration guide for nx-aws-cache', async () => {
    updateNxJson(tree, {
      tasksRunnerOptions: {
        default: {
          runner: '@nx-aws-cache/nx-aws-cache',
          options: {
            cacheableOperations: ['build', 'lint'],
          },
        },
      },
    });
    const nextSteps = await update(tree);
    expect(nextSteps).toMatchInlineSnapshot(`
      [
        "Nx 21 removed support for custom task runners. For more information, please check: https://nx.dev/deprecated/custom-tasks-runner#migrating-from-nxawsplugin",
      ]
    `);
  });

  it('should not remove tasks runner if it is not custom', async () => {
    updateNxJson(tree, {
      tasksRunnerOptions: {
        default: {
          runner: 'nx-cloud',
          options: {
            cacheableOperations: ['build', 'lint'],
          },
        },
      },
    });
    const nextSteps = await update(tree);

    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "tasksRunnerOptions": {
          "default": {
            "options": {
              "cacheableOperations": [
                "build",
                "lint",
              ],
            },
            "runner": "nx-cloud",
          },
        },
      }
    `);
    expect(nextSteps).toHaveLength(0);
  });

  it('should provide a link to the migration guide for other custom runners', async () => {
    updateNxJson(tree, {
      tasksRunnerOptions: {
        default: {
          runner: 'custom-runner',
          options: {
            cacheableOperations: ['build', 'lint'],
          },
        },
      },
    });
    const nextSteps = await update(tree);
    expect(nextSteps).toMatchInlineSnapshot(`
      [
        "Nx 21 removed support for custom task runners. For more information, please check: https://nx.dev/deprecated/custom-tasks-runner",
      ]
    `);
    expect(readNxJson(tree)).toMatchInlineSnapshot(`{}`);
  });
});
