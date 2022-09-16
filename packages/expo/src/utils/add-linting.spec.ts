import { readProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { libraryGenerator } from '@nrwl/workspace/src/generators/library/library';
import { addLinting } from './add-linting';

describe('Add Linting', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    await libraryGenerator(tree, {
      name: 'my-lib',
      linter: Linter.None,
    });
  });

  it('should add update `workspace.json` file properly when eslint is passed', () => {
    addLinting(
      tree,
      'my-lib',
      'libs/my-lib',
      ['libs/my-lib/tsconfig.lib.json'],
      Linter.EsLint
    );
    const project = readProjectConfiguration(tree, 'my-lib');

    expect(project.targets.lint).toBeDefined();
    expect(project.targets.lint.executor).toEqual('@nrwl/linter:eslint');
  });

  it('should add update `workspace.json` file properly when tslint is passed', () => {
    addLinting(
      tree,
      'my-lib',
      'libs/my-lib',
      ['libs/my-lib/tsconfig.lib.json'],
      Linter.TsLint
    );
    const project = readProjectConfiguration(tree, 'my-lib');

    expect(project.targets.lint).toBeDefined();
    expect(project.targets.lint.executor).toEqual(
      '@angular-devkit/build-angular:tslint'
    );
  });

  it('should not add lint target when "none" is passed', async () => {
    addLinting(
      tree,
      'my-lib',
      'libs/my-lib',
      ['libs/my-lib/tsconfig.lib.json'],
      Linter.None
    );
    const project = readProjectConfiguration(tree, 'my-lib');

    expect(project.targets.lint).toBeUndefined();
  });
});
