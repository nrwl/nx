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
      name: 'my-app',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      install: false,
      projectNameAndRootFormat: 'as-provided',
    };
    const options = await normalizeOptions(appTree, schema);
    expect(options).toEqual({
      androidProjectRoot: 'my-app/android',
      appProjectRoot: 'my-app',
      className: 'MyApp',
      displayName: 'MyApp',
      iosProjectRoot: 'my-app/ios',
      lowerCaseName: 'myapp',
      name: 'my-app',
      parsedTags: [],
      projectName: 'my-app',
      projectNameAndRootFormat: 'as-provided',
      linter: Linter.EsLint,
      entryFile: 'src/main.tsx',
      e2eTestRunner: 'none',
      unitTestRunner: 'jest',
      install: false,
    });
  });

  it('should normalize options with name in camel case', async () => {
    const schema: Schema = {
      name: 'myApp',
      e2eTestRunner: 'none',
      install: false,
      projectNameAndRootFormat: 'as-provided',
    };
    const options = await normalizeOptions(appTree, schema);
    expect(options).toEqual({
      androidProjectRoot: 'myApp/android',
      appProjectRoot: 'myApp',
      className: 'MyApp',
      displayName: 'MyApp',
      iosProjectRoot: 'myApp/ios',
      lowerCaseName: 'myapp',
      name: 'myApp',
      parsedTags: [],
      projectName: 'myApp',
      projectNameAndRootFormat: 'as-provided',
      entryFile: 'src/main.tsx',
      e2eTestRunner: 'none',
      unitTestRunner: 'jest',
      install: false,
    });
  });

  it('should normalize options with directory', async () => {
    const schema: Schema = {
      name: 'my-app',
      directory: 'directory/my-app',
      e2eTestRunner: 'none',
      install: false,
      projectNameAndRootFormat: 'as-provided',
    };
    const options = await normalizeOptions(appTree, schema);
    expect(options).toEqual({
      androidProjectRoot: 'directory/my-app/android',
      appProjectRoot: 'directory/my-app',
      className: 'MyApp',
      displayName: 'MyApp',
      iosProjectRoot: 'directory/my-app/ios',
      lowerCaseName: 'myapp',
      name: 'my-app',
      directory: 'directory/my-app',
      parsedTags: [],
      projectName: 'my-app',
      projectNameAndRootFormat: 'as-provided',
      entryFile: 'src/main.tsx',
      e2eTestRunner: 'none',
      unitTestRunner: 'jest',
      install: false,
    });
  });

  it('should normalize options that has directory in its name', async () => {
    const schema: Schema = {
      name: 'directory/my-app',
      e2eTestRunner: 'none',
      install: false,
      projectNameAndRootFormat: 'as-provided',
    };
    const options = await normalizeOptions(appTree, schema);
    expect(options).toEqual({
      androidProjectRoot: 'directory/my-app/android',
      appProjectRoot: 'directory/my-app',
      className: 'DirectoryMyApp',
      displayName: 'DirectoryMyApp',
      iosProjectRoot: 'directory/my-app/ios',
      lowerCaseName: 'directorymyapp',
      name: 'my-app',
      parsedTags: [],
      projectName: 'my-app',
      projectNameAndRootFormat: 'as-provided',
      entryFile: 'src/main.tsx',
      e2eTestRunner: 'none',
      unitTestRunner: 'jest',
      install: false,
    });
  });

  it('should normalize options with display name', async () => {
    const schema: Schema = {
      name: 'my-app',
      displayName: 'My App',
      e2eTestRunner: 'none',
      install: false,
      projectNameAndRootFormat: 'as-provided',
    };
    const options = await normalizeOptions(appTree, schema);
    expect(options).toEqual({
      androidProjectRoot: 'my-app/android',
      appProjectRoot: 'my-app',
      className: 'MyApp',
      displayName: 'My App',
      iosProjectRoot: 'my-app/ios',
      lowerCaseName: 'myapp',
      name: 'my-app',
      parsedTags: [],
      projectName: 'my-app',
      projectNameAndRootFormat: 'as-provided',
      entryFile: 'src/main.tsx',
      e2eTestRunner: 'none',
      unitTestRunner: 'jest',
      install: false,
    });
  });
});
