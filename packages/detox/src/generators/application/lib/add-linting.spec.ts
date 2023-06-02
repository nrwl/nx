import { readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
import { addLinting } from './add-linting';
import { addProject } from './add-project';

describe('Add Linting', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProject(tree, {
      e2eName: 'my-app-e2e',
      e2eProjectName: 'my-app-e2e',
      e2eProjectDirectory: 'apps',
      e2eProjectRoot: 'apps/my-app-e2e',
      appProject: 'my-app',
      appFileName: 'my-app',
      appClassName: 'MyApp',
      appDisplayName: 'MyApp',
      appExpoName: 'MyApp',
      appRoot: 'apps/my-app',
      linter: Linter.EsLint,
      framework: 'react-native',
    });
  });

  it('should update configuration when eslint is passed', () => {
    addLinting(tree, {
      e2eName: 'my-app-e2e',
      e2eProjectName: 'my-app-e2e',
      e2eProjectDirectory: 'apps',
      e2eProjectRoot: 'apps/my-app-e2e',
      appProject: 'my-app',
      appFileName: 'my-app',
      appClassName: 'MyApp',
      appDisplayName: 'MyApp',
      appExpoName: 'MyApp',
      appRoot: 'apps/my-app',
      linter: Linter.EsLint,
      framework: 'react-native',
    });
    const project = readProjectConfiguration(tree, 'my-app-e2e');

    expect(project.targets.lint).toBeDefined();
    expect(project.targets.lint.executor).toEqual('@nx/linter:eslint');
  });

  it('should not add lint target when "none" is passed', async () => {
    addLinting(tree, {
      e2eName: 'my-app-e2e',
      e2eProjectName: 'my-app-e2e',
      e2eProjectDirectory: 'apps',
      e2eProjectRoot: 'apps/my-app-e2e',
      appProject: 'my-app',
      appFileName: 'my-app',
      appClassName: 'MyApp',
      appDisplayName: 'MyApp',
      appExpoName: 'MyApp',
      appRoot: 'apps/my-app',
      linter: Linter.None,
      framework: 'react-native',
    });
    const project = readProjectConfiguration(tree, 'my-app-e2e');

    expect(project.targets.lint).toBeUndefined();
  });
});
