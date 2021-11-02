import {
  addProjectConfiguration,
  readProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import addOutputs from './add-outputs';

describe('addOutputs', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

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
Object {
  "root": "proj",
  "targets": Object {
    "lintWithOutputs": Object {
      "executor": "@nrwl/linter:eslint",
      "options": Object {},
      "outputs": Array [
        "dist",
      ],
    },
    "lintWithoutOutputs": Object {
      "executor": "@nrwl/linter:eslint",
      "options": Object {},
      "outputs": Array [
        "{options.outputFile}",
      ],
    },
    "notLint": Object {
      "executor": "@nrwl/node:build",
      "options": Object {},
    },
  },
}
`);
  });
});
