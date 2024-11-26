import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import { Schema } from '../schema';
import { NormalizedSchema, normalizeOptions } from './normalize-options';

describe('Normalize Options', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace();
  });

  it('should normalize options with name in kebab case', async () => {
    const schema: Schema = {
      directory: 'my-app',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      skipFormat: false,
      js: true,
      unitTestRunner: 'jest',
    };
    const options = await normalizeOptions(appTree, schema);
    expect(options).toEqual({
      addPlugin: true,
      appProjectRoot: 'my-app',
      className: 'MyApp',
      directory: 'my-app',
      displayName: 'MyApp',
      lowerCaseName: 'myapp',
      name: 'my-app',
      parsedTags: [],
      projectName: 'my-app',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      unitTestRunner: 'jest',
      skipFormat: false,
      js: true,
      rootProject: false,
      e2eProjectName: 'my-app-e2e',
      e2eProjectRoot: 'my-app-e2e',
    } as NormalizedSchema);
  });

  it('should normalize options with name in camel case', async () => {
    const schema: Schema = {
      directory: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      skipFormat: false,
      js: true,
      unitTestRunner: 'jest',
    };
    const options = await normalizeOptions(appTree, schema);
    expect(options).toEqual({
      addPlugin: true,
      appProjectRoot: 'myApp',
      className: 'MyApp',
      directory: 'myApp',
      displayName: 'MyApp',
      lowerCaseName: 'myapp',
      name: 'myApp',
      parsedTags: [],
      projectName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      skipFormat: false,
      js: true,
      unitTestRunner: 'jest',
      rootProject: false,
      e2eProjectName: 'myApp-e2e',
      e2eProjectRoot: 'myApp-e2e',
    } as NormalizedSchema);
  });

  it('should normalize options with directory', async () => {
    const schema: Schema = {
      name: 'my-app',
      directory: 'directory',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      skipFormat: false,
      js: true,
      unitTestRunner: 'jest',
    };
    const options = await normalizeOptions(appTree, schema);
    expect(options).toEqual({
      addPlugin: true,
      appProjectRoot: 'directory',
      className: 'MyApp',
      displayName: 'MyApp',
      lowerCaseName: 'myapp',
      name: 'my-app',
      directory: 'directory',
      parsedTags: [],
      projectName: 'my-app',
      e2eTestRunner: 'none',
      unitTestRunner: 'jest',
      linter: Linter.EsLint,
      skipFormat: false,
      js: true,
      rootProject: false,
      e2eProjectName: 'my-app-e2e',
      e2eProjectRoot: 'directory-e2e',
    } as NormalizedSchema);
  });

  it('should normalize options that has directory in its name', async () => {
    const schema: Schema = {
      directory: 'directory/my-app',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      skipFormat: false,
      js: true,
      unitTestRunner: 'jest',
    };
    const options = await normalizeOptions(appTree, schema);
    expect(options).toEqual({
      addPlugin: true,
      appProjectRoot: 'directory/my-app',
      className: 'MyApp',
      directory: 'directory/my-app',
      displayName: 'MyApp',
      lowerCaseName: 'myapp',
      name: 'my-app',
      parsedTags: [],
      projectName: 'my-app',
      e2eTestRunner: 'none',
      unitTestRunner: 'jest',
      linter: Linter.EsLint,
      skipFormat: false,
      js: true,
      rootProject: false,
      e2eProjectName: 'my-app-e2e',
      e2eProjectRoot: 'directory/my-app-e2e',
    } as NormalizedSchema);
  });

  it('should normalize options with display name', async () => {
    const schema: Schema = {
      directory: 'my-app',
      displayName: 'My App',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      skipFormat: false,
      js: true,
      unitTestRunner: 'jest',
    };
    const options = await normalizeOptions(appTree, schema);
    expect(options).toEqual({
      addPlugin: true,
      appProjectRoot: 'my-app',
      directory: 'my-app',
      className: 'MyApp',
      displayName: 'My App',
      lowerCaseName: 'myapp',
      name: 'my-app',
      parsedTags: [],
      projectName: 'my-app',
      e2eTestRunner: 'none',
      unitTestRunner: 'jest',
      linter: Linter.EsLint,
      skipFormat: false,
      js: true,
      rootProject: false,
      e2eProjectName: 'my-app-e2e',
      e2eProjectRoot: 'my-app-e2e',
    } as NormalizedSchema);
  });
});
