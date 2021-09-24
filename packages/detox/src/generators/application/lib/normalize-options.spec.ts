import { addProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { Schema } from '../schema';
import { normalizeOptions } from './normalize-options';

describe('Normalize Options', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace();
  });

  it('should normalize options with name in kebab case', () => {
    addProjectConfiguration(appTree, 'my-app', {
      root: 'apps/my-app',
      targets: {},
    });
    const schema: Schema = {
      name: 'my-app-e2e',
      project: 'my-app',
      linter: Linter.EsLint,
    };
    const options = normalizeOptions(appTree, schema);
    expect(options).toEqual({
      name: 'my-app-e2e',
      projectName: 'my-app-e2e',
      projectRoot: 'apps/my-app-e2e',
      project: 'my-app',
      appFileName: 'my-app',
      appClassName: 'MyApp',
      linter: Linter.EsLint,
    });
  });

  it('should normalize options with name in camel case', () => {
    addProjectConfiguration(appTree, 'my-app', {
      root: 'apps/my-app',
      targets: {},
    });
    const schema: Schema = {
      name: 'myAppE2e',
      project: 'myApp',
    };
    const options = normalizeOptions(appTree, schema);
    expect(options).toEqual({
      appClassName: 'MyApp',
      appFileName: 'my-app',
      name: 'my-app-e2e',
      project: 'myApp',
      projectName: 'my-app-e2e',
      projectRoot: 'apps/my-app-e2e',
    });
  });

  it('should normalize options with directory', () => {
    addProjectConfiguration(appTree, 'my-app', {
      root: 'apps/my-app',
      targets: {},
    });
    const schema: Schema = {
      name: 'my-app-e2e',
      project: 'my-app',
      directory: 'directory',
    };
    const options = normalizeOptions(appTree, schema);
    expect(options).toEqual({
      project: 'my-app',
      appClassName: 'MyApp',
      appFileName: 'my-app',
      projectRoot: 'apps/directory/my-app-e2e',
      name: 'my-app-e2e',
      directory: 'directory',
      projectName: 'directory-my-app-e2e',
    });
  });

  it('should normalize options with directory in its name', () => {
    addProjectConfiguration(appTree, 'my-app', {
      root: 'apps/my-app',
      targets: {},
    });
    const schema: Schema = {
      name: 'directory/my-app-e2e',
      project: 'my-app',
    };
    const options = normalizeOptions(appTree, schema);
    expect(options).toEqual({
      project: 'my-app',
      appClassName: 'MyApp',
      appFileName: 'my-app',
      projectRoot: 'apps/directory/my-app-e2e',
      name: 'directory/my-app-e2e',
      projectName: 'directory-my-app-e2e',
    });
  });
});
