import { readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addLinting } from './add-linting';
import { addProject } from './add-project';

describe('Add Linting', () => {
  let tree: Tree;
  let envBackup: string | undefined;

  beforeEach(async () => {
    envBackup = process.env.ESLINT_USE_FLAT_CONFIG;
    delete process.env.ESLINT_USE_FLAT_CONFIG;
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProject(tree, {
      e2eDirectory: 'my-app-e2e',
      e2eProjectName: 'my-app-e2e',
      e2eProjectRoot: 'apps/my-app-e2e',
      importPath: '@proj/my-app-e2e',
      appProject: 'my-app',
      appFileName: 'my-app',
      appClassName: 'MyApp',
      appDisplayName: 'MyApp',
      appExpoName: 'MyApp',
      appRoot: 'apps/my-app',
      linter: 'eslint',
      isUsingTsSolutionConfig: false,
      framework: 'react-native',
    });
  });

  afterEach(() => {
    if (envBackup === undefined) delete process.env.ESLINT_USE_FLAT_CONFIG;
    else process.env.ESLINT_USE_FLAT_CONFIG = envBackup;
  });

  it('should update configuration when eslint is passed', async () => {
    await addLinting(tree, {
      e2eDirectory: 'my-app-e2e',
      e2eProjectName: 'my-app-e2e',
      e2eProjectRoot: 'apps/my-app-e2e',
      importPath: '@proj/my-app-e2e',
      appProject: 'my-app',
      appFileName: 'my-app',
      appClassName: 'MyApp',
      appDisplayName: 'MyApp',
      appExpoName: 'MyApp',
      appRoot: 'apps/my-app',
      linter: 'eslint',
      isUsingTsSolutionConfig: false,
      framework: 'react-native',
    });

    expect(tree.exists('apps/my-app-e2e/eslint.config.mjs')).toBeTruthy();
  });

  it('should generate the .eslintrc.json file (eslintrc)', async () => {
    process.env.ESLINT_USE_FLAT_CONFIG = 'false';
    await addLinting(tree, {
      e2eDirectory: 'my-app-e2e',
      e2eProjectName: 'my-app-e2e',
      e2eProjectRoot: 'apps/my-app-e2e',
      importPath: '@proj/my-app-e2e',
      appProject: 'my-app',
      appFileName: 'my-app',
      appClassName: 'MyApp',
      appDisplayName: 'MyApp',
      appExpoName: 'MyApp',
      appRoot: 'apps/my-app',
      linter: 'eslint',
      isUsingTsSolutionConfig: false,
      framework: 'react-native',
    });

    expect(tree.exists('apps/my-app-e2e/.eslintrc.json')).toBeTruthy();
  });

  it('should not add lint target when "none" is passed', async () => {
    await addLinting(tree, {
      e2eDirectory: 'my-app-e2e',
      e2eProjectName: 'my-app-e2e',
      e2eProjectRoot: 'apps/my-app-e2e',
      importPath: '@proj/my-app-e2e',
      appProject: 'my-app',
      appFileName: 'my-app',
      appClassName: 'MyApp',
      appDisplayName: 'MyApp',
      appExpoName: 'MyApp',
      appRoot: 'apps/my-app',
      linter: 'none',
      isUsingTsSolutionConfig: false,
      framework: 'react-native',
    });
    const project = readProjectConfiguration(tree, 'my-app-e2e');

    expect(project.targets.lint).toBeUndefined();
  });
});
