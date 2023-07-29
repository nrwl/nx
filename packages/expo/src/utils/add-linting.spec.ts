import { readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
import { libraryGenerator } from '@nx/js';
import { addLinting } from './add-linting';

describe('Add Linting', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await libraryGenerator(tree, {
      name: 'my-lib',
      linter: Linter.None,
    });
  });

  it('should add update configuration when eslint is passed', () => {
    addLinting(tree, {
      projectName: 'my-lib',
      linter: Linter.EsLint,
      tsConfigPaths: ['libs/my-lib/tsconfig.lib.json'],
      projectRoot: 'libs/my-lib',
    });
    const project = readProjectConfiguration(tree, 'my-lib');

    expect(project.targets.lint).toBeDefined();
    expect(project.targets.lint.executor).toEqual('@nx/linter:eslint');
  });

  it('should not add lint target when "none" is passed', async () => {
    addLinting(tree, {
      projectName: 'my-lib',
      linter: Linter.None,
      tsConfigPaths: ['libs/my-lib/tsconfig.lib.json'],
      projectRoot: 'libs/my-lib',
    });
    const project = readProjectConfiguration(tree, 'my-lib');

    expect(project.targets.lint).toBeUndefined();
  });
});
