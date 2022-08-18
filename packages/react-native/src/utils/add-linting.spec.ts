import { readProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyV1Workspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { libraryGenerator } from '@nrwl/workspace/src/generators/library/library';
import { addLinting } from './add-linting';

describe('Add Linting', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyV1Workspace();
    await libraryGenerator(tree, {
      name: 'my-lib',
      linter: Linter.None,
    });
  });

  it('should add update `workspace.json` file properly when eslint is passed', () => {
    addLinting(tree, {
      projectName: 'my-lib',
      linter: Linter.EsLint,
      tsConfigPaths: ['libs/my-lib/tsconfig.lib.json'],
      projectRoot: 'libs/my-lib',
    });
    const project = readProjectConfiguration(tree, 'my-lib');

    expect(project.targets.lint).toBeDefined();
    expect(project.targets.lint.executor).toEqual('@nrwl/linter:eslint');
  });

  it('should add update `workspace.json` file properly when tslint is passed', () => {
    addLinting(tree, {
      projectName: 'my-lib',
      linter: Linter.TsLint,
      tsConfigPaths: ['libs/my-lib/tsconfig.lib.json'],
      projectRoot: 'libs/my-lib',
    });
    const project = readProjectConfiguration(tree, 'my-lib');

    expect(project.targets.lint).toBeDefined();
    expect(project.targets.lint.executor).toEqual(
      '@angular-devkit/build-angular:tslint'
    );
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
