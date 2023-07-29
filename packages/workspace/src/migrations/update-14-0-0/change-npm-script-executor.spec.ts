import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import changeNpmScriptExecutor from './change-npm-script-executor';

describe('changeNxJsonPresets', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    addProjectConfiguration(tree, 'proj1', {
      root: 'proj1',
      targets: {
        scriptTarget: {
          executor: '@nrwl/workspace:run-script',
          options: {},
        },
        notScriptTarget: {
          executor: '@nrwl/workspace:something',
          options: {},
        },
      },
    });
  });

  it('should change the npm script executor to nx:npm-script', async () => {
    await changeNpmScriptExecutor(tree);

    expect(readProjectConfiguration(tree, 'proj1')).toMatchInlineSnapshot(`
      {
        "$schema": "../node_modules/nx/schemas/project-schema.json",
        "name": "proj1",
        "root": "proj1",
        "targets": {
          "notScriptTarget": {
            "executor": "@nrwl/workspace:something",
            "options": {},
          },
          "scriptTarget": {
            "executor": "nx:run-script",
            "options": {},
          },
        },
      }
    `);
  });
});
