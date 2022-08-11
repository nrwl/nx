import { addProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyV1Workspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { Schema } from '../schema';
import { normalizeOptions } from './normalize-options';

describe('Normalize Options', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = createTreeWithEmptyV1Workspace();
  });

  it('should normalize options with name in kebab case', () => {
    addProjectConfiguration(appTree, 'my-app', {
      root: 'apps/my-app',
      targets: {},
    });
    const schema: Schema = {
      framework: 'react-native',
      name: 'my-app-e2e',
      project: 'my-app',
      linter: Linter.EsLint,
    };
    const options = normalizeOptions(appTree, schema);
    expect(options).toEqual({
      framework: 'react-native',
      name: 'my-app-e2e',
      projectName: 'my-app-e2e',
      projectDirectory: 'apps',
      projectRoot: 'apps/my-app-e2e',
      project: 'my-app',
      appFileName: 'my-app',
      appClassName: 'MyApp',
      appDisplayName: 'MyApp',
      linter: Linter.EsLint,
    });
  });

  it('should normalize options with name in camel case', () => {
    addProjectConfiguration(appTree, 'my-app', {
      root: 'apps/my-app',
      targets: {},
    });
    const schema: Schema = {
      framework: 'react-native',
      name: 'myAppE2e',
      project: 'myApp',
    };
    const options = normalizeOptions(appTree, schema);
    expect(options).toEqual({
      appClassName: 'MyApp',
      appDisplayName: 'MyApp',
      appFileName: 'my-app',
      name: 'my-app-e2e',
      project: 'myApp',
      projectName: 'my-app-e2e',
      projectDirectory: 'apps',
      projectRoot: 'apps/my-app-e2e',
      framework: 'react-native',
    });
  });

  it('should normalize options with display name', () => {
    addProjectConfiguration(appTree, 'my-app', {
      root: 'apps/my-app',
      targets: {},
    });
    const schema: Schema = {
      framework: 'react-native',
      name: 'myAppE2e',
      project: 'myApp',
      displayName: 'app display name',
    };
    const options = normalizeOptions(appTree, schema);
    expect(options).toEqual({
      displayName: 'app display name',
      appClassName: 'MyApp',
      appDisplayName: 'AppDisplayName',
      appFileName: 'my-app',
      name: 'my-app-e2e',
      project: 'myApp',
      projectName: 'my-app-e2e',
      projectDirectory: 'apps',
      projectRoot: 'apps/my-app-e2e',
      framework: 'react-native',
    });
  });

  it('should normalize options with directory', () => {
    addProjectConfiguration(appTree, 'my-app', {
      root: 'apps/my-app',
      targets: {},
    });
    const schema: Schema = {
      framework: 'react-native',
      name: 'my-app-e2e',
      project: 'my-app',
      directory: 'directory',
    };
    const options = normalizeOptions(appTree, schema);
    expect(options).toEqual({
      project: 'my-app',
      appClassName: 'MyApp',
      appDisplayName: 'MyApp',
      appFileName: 'my-app',
      projectDirectory: 'apps/directory',
      projectRoot: 'apps/directory/my-app-e2e',
      name: 'my-app-e2e',
      directory: 'directory',
      projectName: 'directory-my-app-e2e',
      framework: 'react-native',
    });
  });

  it('should normalize options with directory in its name', () => {
    addProjectConfiguration(appTree, 'my-app', {
      root: 'apps/my-app',
      targets: {},
    });
    const schema: Schema = {
      framework: 'react-native',
      name: 'directory/my-app-e2e',
      project: 'my-app',
    };
    const options = normalizeOptions(appTree, schema);
    expect(options).toEqual({
      project: 'my-app',
      appClassName: 'MyApp',
      appDisplayName: 'MyApp',
      appFileName: 'my-app',
      projectRoot: 'apps/directory/my-app-e2e',
      projectDirectory: 'apps',
      name: 'directory/my-app-e2e',
      projectName: 'directory-my-app-e2e',
      framework: 'react-native',
    });
  });
});
