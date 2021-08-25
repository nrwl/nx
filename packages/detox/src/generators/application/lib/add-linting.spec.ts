import { readProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { addLinting } from './add-linting';
import { addProject } from './add-project';

describe('Add Linting', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    addProject(tree, {
      name: 'my-app-e2e',
      projectName: 'my-app-e2e',
      projectRoot: 'apps/my-app-e2e',
      project: 'my-app',
      appFileName: 'my-app',
      appClassName: 'MyApp',
      linter: Linter.EsLint,
    });
  });

  it('should add update `workspace.json` file properly when eslint is passed', () => {
    addLinting(tree, {
      name: 'my-app-e2e',
      projectName: 'my-app-e2e',
      projectRoot: 'apps/my-app-e2e',
      project: 'my-app',
      appFileName: 'my-app',
      appClassName: 'MyApp',
      linter: Linter.EsLint,
    });
    const project = readProjectConfiguration(tree, 'my-app-e2e');

    expect(project.targets.lint).toBeDefined();
    expect(project.targets.lint.executor).toEqual('@nrwl/linter:eslint');
  });

  it('should add update `workspace.json` file properly when tslint is passed', () => {
    addLinting(tree, {
      name: 'my-app-e2e',
      projectName: 'my-app-e2e',
      projectRoot: 'apps/my-app-e2e',
      project: 'my-app',
      appFileName: 'my-app',
      appClassName: 'MyApp',
      linter: Linter.TsLint,
    });
    const project = readProjectConfiguration(tree, 'my-app-e2e');

    expect(project.targets.lint).toBeDefined();
    expect(project.targets.lint.executor).toEqual(
      '@angular-devkit/build-angular:tslint'
    );
  });

  it('should not add lint target when "none" is passed', async () => {
    addLinting(tree, {
      name: 'my-app-e2e',
      projectName: 'my-app-e2e',
      projectRoot: 'apps/my-app-e2e',
      project: 'my-app',
      appFileName: 'my-app',
      appClassName: 'MyApp',
      linter: Linter.None,
    });
    const project = readProjectConfiguration(tree, 'my-app-e2e');

    expect(project.targets.lint).toBeUndefined();
  });
});
