import {
  addProjectConfiguration,
  readProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import addOutputs from './add-outputs';

describe('addOutputs', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    const lintWithoutOutputs: TargetConfiguration = {
      executor: '@nrwl/linter:eslint',
      options: {},
    };
    const lintWithOutputs: TargetConfiguration = {
      executor: '@nrwl/linter:eslint',
      outputs: ['dist'],
      options: {},
    };
    const notLint: TargetConfiguration = {
      executor: '@nrwl/node:build',
      options: {},
    };

    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
      targets: {
        lintWithoutOutputs,
        lintWithOutputs,
        notLint,
      },
    });
  });

  it('should add outputs to targets that do not have outputs', async () => {
    await addOutputs(tree);

    expect(readProjectConfiguration(tree, 'proj')).toMatchInlineSnapshot(`
      {
        "$schema": "../node_modules/nx/schemas/project-schema.json",
        "name": "proj",
        "root": "proj",
        "targets": {
          "lintWithOutputs": {
            "executor": "@nrwl/linter:eslint",
            "options": {},
            "outputs": [
              "dist",
            ],
          },
          "lintWithoutOutputs": {
            "executor": "@nrwl/linter:eslint",
            "options": {},
            "outputs": [
              "{options.outputFile}",
            ],
          },
          "notLint": {
            "executor": "@nrwl/node:build",
            "options": {},
          },
        },
      }
    `);
  });
});
