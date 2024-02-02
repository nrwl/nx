import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import { libraryGenerator } from '@nx/js';
import { addLinting } from './add-linting';

describe('Add Linting', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    await libraryGenerator(tree, {
      name: 'my-lib',
      linter: Linter.None,
      projectNameAndRootFormat: 'as-provided',
    });
  });

  it('should add update configuration when eslint is passed', async () => {
    await addLinting(tree, {
      projectName: 'my-lib',
      linter: Linter.EsLint,
      tsConfigPaths: ['my-lib/tsconfig.lib.json'],
      projectRoot: 'my-lib',
      addPlugin: true,
    });

    expect(tree.exists('my-lib/.eslintrc.json')).toBeTruthy();
  });

  it('should not add lint target when "none" is passed', async () => {
    await addLinting(tree, {
      projectName: 'my-lib',
      linter: Linter.None,
      tsConfigPaths: ['my-lib/tsconfig.lib.json'],
      projectRoot: 'my-lib',
      addPlugin: true,
    });

    expect(tree.exists('my-lib/.eslintrc.json')).toBeFalsy();
  });
});
