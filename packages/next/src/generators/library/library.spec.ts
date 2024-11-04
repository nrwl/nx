import { installedCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import { readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import libraryGenerator from './library';
import { Schema } from './schema';

// need to mock cypress otherwise it'll use the nx installed version from package.json
//  which is v9 while we are testing for the new v10 version
jest.mock('@nx/cypress/src/utils/cypress-version');

describe('next library', () => {
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;
  it('should use @nx/next images.d.ts file', async () => {
    const baseOptions: Schema = {
      directory: '',
      linter: Linter.EsLint,
      skipFormat: false,
      skipTsConfig: false,
      unitTestRunner: 'jest',
      style: 'css',
      component: true,
    };
    const appTree = createTreeWithEmptyWorkspace();

    await libraryGenerator(appTree, {
      ...baseOptions,
      directory: 'my-lib',
    });
    const tsconfigTypes = readJson(appTree, 'my-lib/tsconfig.lib.json')
      .compilerOptions.types;

    expect(tsconfigTypes).toContain('@nx/next/typings/image.d.ts');
  });

  it('should add jsxImportSource in tsconfig.json for @emotion/styled', async () => {
    const baseOptions: Schema = {
      directory: '',
      linter: Linter.EsLint,
      skipFormat: false,
      skipTsConfig: false,
      unitTestRunner: 'jest',
      style: 'css',
      component: true,
    };

    const appTree = createTreeWithEmptyWorkspace();

    await libraryGenerator(appTree, {
      ...baseOptions,
      directory: 'my-lib',
    });
    await libraryGenerator(appTree, {
      ...baseOptions,
      directory: 'my-lib2',
      style: '@emotion/styled',
    });

    expect(
      readJson(appTree, 'my-lib/tsconfig.json').compilerOptions.jsxImportSource
    ).not.toBeDefined();
    expect(
      readJson(appTree, 'my-lib2/tsconfig.json').compilerOptions.jsxImportSource
    ).toEqual('@emotion/react');
  });

  it('should generate a server-only entry point', async () => {
    const appTree = createTreeWithEmptyWorkspace();

    await libraryGenerator(appTree, {
      directory: 'my-lib',
      linter: Linter.EsLint,
      skipFormat: false,
      skipTsConfig: false,
      unitTestRunner: 'jest',
      style: 'css',
      component: true,
    });

    expect(appTree.read('my-lib/src/index.ts', 'utf-8')).toContain(
      'React client components'
    );
    expect(appTree.read('my-lib/src/server.ts', 'utf-8')).toContain(
      'React server components'
    );
    expect(
      readJson(appTree, 'tsconfig.base.json').compilerOptions.paths
    ).toMatchObject({
      '@proj/my-lib': ['my-lib/src/index.ts'],
      '@proj/my-lib/server': ['my-lib/src/server.ts'],
    });
  });

  it('should not add cypress dependencies', async () => {
    const appTree = createTreeWithEmptyWorkspace();

    await libraryGenerator(appTree, {
      directory: 'my-lib',
      linter: Linter.EsLint,
      skipFormat: false,
      skipTsConfig: false,
      unitTestRunner: 'jest',
      style: 'css',
      component: false,
    });

    expect(
      readJson(appTree, 'package.json').devDependencies['@nx/cypress']
    ).toBeUndefined();
    expect(
      readJson(appTree, 'package.json').devDependencies['cypress']
    ).toBeUndefined();
  });
});
