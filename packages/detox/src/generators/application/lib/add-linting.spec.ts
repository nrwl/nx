import { readProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyV1Workspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { addLinting } from './add-linting';
import { addProject } from './add-project';

describe('Add Linting', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyV1Workspace();
    addProject(tree, {
      name: 'my-app-e2e',
      projectName: 'my-app-e2e',
      projectDirectory: 'apps',
      projectRoot: 'apps/my-app-e2e',
      project: 'my-app',
      appFileName: 'my-app',
      appClassName: 'MyApp',
      appDisplayName: 'MyApp',
      linter: Linter.EsLint,
      framework: 'react-native',
    });
  });

  it('should add update `workspace.json` file properly when eslint is passed', () => {
    addLinting(tree, {
      name: 'my-app-e2e',
      projectName: 'my-app-e2e',
      projectDirectory: 'apps',
      projectRoot: 'apps/my-app-e2e',
      project: 'my-app',
      appFileName: 'my-app',
      appClassName: 'MyApp',
      appDisplayName: 'MyApp',
      linter: Linter.EsLint,
      framework: 'react-native',
    });
    const project = readProjectConfiguration(tree, 'my-app-e2e');

    expect(project.targets.lint).toBeDefined();
    expect(project.targets.lint.executor).toEqual('@nrwl/linter:eslint');
  });

  it('should add update `workspace.json` file properly when tslint is passed', () => {
    addLinting(tree, {
      name: 'my-app-e2e',
      projectName: 'my-app-e2e',
      projectDirectory: 'apps',
      projectRoot: 'apps/my-app-e2e',
      project: 'my-app',
      appFileName: 'my-app',
      appClassName: 'MyApp',
      appDisplayName: 'MyApp',
      linter: Linter.TsLint,
      framework: 'react-native',
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
      projectDirectory: 'apps',
      projectRoot: 'apps/my-app-e2e',
      project: 'my-app',
      appFileName: 'my-app',
      appClassName: 'MyApp',
      appDisplayName: 'MyApp',
      linter: Linter.None,
      framework: 'react-native',
    });
    const project = readProjectConfiguration(tree, 'my-app-e2e');

    expect(project.targets.lint).toBeUndefined();
  });
});
