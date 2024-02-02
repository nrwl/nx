import { readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import { addLinting } from './add-linting';
import { addProject } from './add-project';

describe('Add Linting', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProject(tree, {
      e2eName: 'my-app-e2e',
      e2eProjectName: 'my-app-e2e',
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

  it('should update configuration when eslint is passed', async () => {
    await addLinting(tree, {
      e2eName: 'my-app-e2e',
      e2eProjectName: 'my-app-e2e',
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

    expect(tree.exists('apps/my-app-e2e/.eslintrc.json')).toBeTruthy();
  });

  it('should not add lint target when "none" is passed', async () => {
    await addLinting(tree, {
      e2eName: 'my-app-e2e',
      e2eProjectName: 'my-app-e2e',
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
