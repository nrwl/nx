import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import { Schema } from '../schema';
import { normalizeOptions } from './normalize-options';

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
      install: false,
      unitTestRunner: 'none',
      bundler: 'vite',
    };
    const options = await normalizeOptions(appTree, schema);
    expect(options).toEqual({
      addPlugin: true,
      androidProjectRoot: 'my-app/android',
      appProjectRoot: 'my-app',
      fileName: 'my-app',
      className: 'MyApp',
      directory: 'my-app',
      displayName: 'MyApp',
      iosProjectRoot: 'my-app/ios',
      lowerCaseName: 'myapp',
      name: 'my-app',
      parsedTags: [],
      projectName: 'my-app',
      linter: Linter.EsLint,
      entryFile: 'src/main.tsx',
      e2eTestRunner: 'none',
      unitTestRunner: 'none',
      install: false,
      bundler: 'vite',
      rootProject: false,
      e2eProjectName: 'my-app-e2e',
      e2eProjectRoot: 'my-app-e2e',
    });
  });

  it('should normalize options with name in camel case', async () => {
    const schema: Schema = {
      directory: 'myApp',
      e2eTestRunner: 'none',
      install: false,
      linter: Linter.None,
      unitTestRunner: 'none',
      bundler: 'vite',
    };
    const options = await normalizeOptions(appTree, schema);
    expect(options).toEqual({
      addPlugin: true,
      androidProjectRoot: 'myApp/android',
      appProjectRoot: 'myApp',
      className: 'MyApp',
      fileName: 'my-app',
      directory: 'myApp',
      displayName: 'MyApp',
      iosProjectRoot: 'myApp/ios',
      lowerCaseName: 'myapp',
      name: 'myApp',
      parsedTags: [],
      projectName: 'myApp',
      entryFile: 'src/main.tsx',
      e2eTestRunner: 'none',
      unitTestRunner: 'none',
      install: false,
      bundler: 'vite',
      linter: Linter.None,
      rootProject: false,
      e2eProjectName: 'myApp-e2e',
      e2eProjectRoot: 'myApp-e2e',
    });
  });

  it('should normalize options with directory', async () => {
    const schema: Schema = {
      name: 'my-app',
      directory: 'directory/my-app',
      e2eTestRunner: 'none',
      install: false,
      linter: Linter.None,
      unitTestRunner: 'none',
      bundler: 'vite',
    };
    const options = await normalizeOptions(appTree, schema);
    expect(options).toEqual({
      addPlugin: true,
      androidProjectRoot: 'directory/my-app/android',
      appProjectRoot: 'directory/my-app',
      className: 'MyApp',
      fileName: 'my-app',
      directory: 'directory/my-app',
      displayName: 'MyApp',
      iosProjectRoot: 'directory/my-app/ios',
      lowerCaseName: 'myapp',
      name: 'my-app',
      parsedTags: [],
      projectName: 'my-app',
      entryFile: 'src/main.tsx',
      e2eTestRunner: 'none',
      unitTestRunner: 'none',
      install: false,
      bundler: 'vite',
      linter: Linter.None,
      rootProject: false,
      e2eProjectName: 'my-app-e2e',
      e2eProjectRoot: 'directory/my-app-e2e',
    });
  });

  it('should normalize options that has directory in its name', async () => {
    const schema: Schema = {
      directory: 'directory/my-app',
      e2eTestRunner: 'none',
      install: false,
      linter: Linter.None,
      unitTestRunner: 'none',
      bundler: 'vite',
    };
    const options = await normalizeOptions(appTree, schema);
    expect(options).toEqual({
      addPlugin: true,
      androidProjectRoot: 'directory/my-app/android',
      appProjectRoot: 'directory/my-app',
      className: 'MyApp',
      directory: 'directory/my-app',
      fileName: 'my-app',
      displayName: 'MyApp',
      iosProjectRoot: 'directory/my-app/ios',
      lowerCaseName: 'myapp',
      name: 'my-app',
      parsedTags: [],
      projectName: 'my-app',
      entryFile: 'src/main.tsx',
      e2eTestRunner: 'none',
      unitTestRunner: 'none',
      install: false,
      bundler: 'vite',
      linter: Linter.None,
      rootProject: false,
      e2eProjectName: 'my-app-e2e',
      e2eProjectRoot: 'directory/my-app-e2e',
    });
  });

  it('should normalize options with display name', async () => {
    const schema: Schema = {
      directory: 'my-app',
      displayName: 'My App',
      e2eTestRunner: 'none',
      install: false,
      linter: Linter.None,
      unitTestRunner: 'none',
      bundler: 'vite',
    };
    const options = await normalizeOptions(appTree, schema);
    expect(options).toEqual({
      addPlugin: true,
      androidProjectRoot: 'my-app/android',
      appProjectRoot: 'my-app',
      className: 'MyApp',
      fileName: 'my-app',
      directory: 'my-app',
      displayName: 'My App',
      iosProjectRoot: 'my-app/ios',
      lowerCaseName: 'myapp',
      name: 'my-app',
      parsedTags: [],
      projectName: 'my-app',
      entryFile: 'src/main.tsx',
      e2eTestRunner: 'none',
      unitTestRunner: 'none',
      install: false,
      bundler: 'vite',
      linter: Linter.None,
      rootProject: false,
      e2eProjectName: 'my-app-e2e',
      e2eProjectRoot: 'my-app-e2e',
    });
  });
});
