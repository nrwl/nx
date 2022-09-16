import { Linter } from '@nrwl/linter';
import { Schema } from '../schema';
import { normalizeOptions } from './normalize-options';

describe('Normalize Options', () => {
  it('should normalize options with name in kebab case', () => {
    const schema: Schema = {
      name: 'my-app',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      skipFormat: false,
      js: true,
      unitTestRunner: 'jest',
    };
    const options = normalizeOptions(schema);
    expect(options).toEqual({
      appProjectRoot: 'apps/my-app',
      className: 'MyApp',
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
    });
  });

  it('should normalize options with name in camel case', () => {
    const schema: Schema = {
      name: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      skipFormat: false,
      js: true,
      unitTestRunner: 'jest',
    };
    const options = normalizeOptions(schema);
    expect(options).toEqual({
      appProjectRoot: 'apps/my-app',
      className: 'MyApp',
      displayName: 'MyApp',
      lowerCaseName: 'myapp',
      name: 'my-app',
      parsedTags: [],
      projectName: 'my-app',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      skipFormat: false,
      js: true,
      unitTestRunner: 'jest',
    });
  });

  it('should normalize options with directory', () => {
    const schema: Schema = {
      name: 'my-app',
      directory: 'directory',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      skipFormat: false,
      js: true,
      unitTestRunner: 'jest',
    };
    const options = normalizeOptions(schema);
    expect(options).toEqual({
      appProjectRoot: 'apps/directory/my-app',
      className: 'MyApp',
      displayName: 'MyApp',
      lowerCaseName: 'myapp',
      name: 'my-app',
      directory: 'directory',
      parsedTags: [],
      projectName: 'directory-my-app',
      e2eTestRunner: 'none',
      unitTestRunner: 'jest',
      linter: Linter.EsLint,
      skipFormat: false,
      js: true,
    });
  });

  it('should normalize options that has directory in its name', () => {
    const schema: Schema = {
      name: 'directory/my-app',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      skipFormat: false,
      js: true,
      unitTestRunner: 'jest',
    };
    const options = normalizeOptions(schema);
    expect(options).toEqual({
      appProjectRoot: 'apps/directory/my-app',
      className: 'DirectoryMyApp',
      displayName: 'DirectoryMyApp',
      lowerCaseName: 'directorymyapp',
      name: 'directory/my-app',
      parsedTags: [],
      projectName: 'directory-my-app',
      e2eTestRunner: 'none',
      unitTestRunner: 'jest',
      linter: Linter.EsLint,
      skipFormat: false,
      js: true,
    });
  });

  it('should normalize options with display name', () => {
    const schema: Schema = {
      name: 'my-app',
      displayName: 'My App',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      skipFormat: false,
      js: true,
      unitTestRunner: 'jest',
    };
    const options = normalizeOptions(schema);
    expect(options).toEqual({
      appProjectRoot: 'apps/my-app',
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
    });
  });
});
