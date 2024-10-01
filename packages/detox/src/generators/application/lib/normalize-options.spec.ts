import { addProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';

import { Schema } from '../schema';
import { normalizeOptions } from './normalize-options';

describe('Normalize Options', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should normalize options with name in kebab case', async () => {
    addProjectConfiguration(appTree, 'my-app', {
      root: 'apps/my-app',
      targets: {},
    });
    const schema: Schema = {
      framework: 'react-native',
      e2eDirectory: 'apps/my-app-e2e',
      appProject: 'my-app',
      linter: Linter.EsLint,
    };
    const options = await normalizeOptions(appTree, schema);
    expect(options).toEqual({
      addPlugin: true,
      framework: 'react-native',
      e2eName: 'my-app-e2e',
      e2eDirectory: 'apps/my-app-e2e',
      e2eProjectName: 'my-app-e2e',
      e2eProjectRoot: 'apps/my-app-e2e',
      appProject: 'my-app',
      appFileName: 'my-app',
      appClassName: 'MyApp',
      appDisplayName: 'MyApp',
      appExpoName: 'MyApp',
      appRoot: 'apps/my-app',
      linter: Linter.EsLint,
    });
  });

  it('should normalize options with display name', async () => {
    addProjectConfiguration(appTree, 'my-app', {
      root: 'apps/my-app',
      targets: {},
    });
    const schema: Schema = {
      framework: 'react-native',
      e2eDirectory: 'apps/my-app-e2e',
      appProject: 'my-app',
      appDisplayName: 'app display name',
    };
    const options = await normalizeOptions(appTree, schema);
    expect(options).toEqual({
      addPlugin: true,
      appDisplayName: 'app display name',
      appExpoName: 'appdisplayname',
      appClassName: 'MyApp',
      appFileName: 'my-app',
      appRoot: 'apps/my-app',
      e2eName: 'my-app-e2e',
      e2eDirectory: 'apps/my-app-e2e',
      appProject: 'my-app',
      e2eProjectName: 'my-app-e2e',
      e2eProjectRoot: 'apps/my-app-e2e',
      framework: 'react-native',
    });
  });

  it('should normalize options with directory', async () => {
    addProjectConfiguration(appTree, 'my-app', {
      root: 'apps/my-app',
      targets: {},
    });
    const schema: Schema = {
      framework: 'react-native',
      e2eName: 'directory-my-app-e2e',
      appProject: 'my-app',
      e2eDirectory: 'directory',
    };
    const options = await normalizeOptions(appTree, schema);
    expect(options).toEqual({
      addPlugin: true,
      appProject: 'my-app',
      appClassName: 'MyApp',
      appDisplayName: 'MyApp',
      appExpoName: 'MyApp',
      appFileName: 'my-app',
      appRoot: 'apps/my-app',
      e2eProjectRoot: 'directory',
      e2eName: 'directory-my-app-e2e',
      e2eDirectory: 'directory',
      e2eProjectName: 'directory-my-app-e2e',
      framework: 'react-native',
    });
  });
});
