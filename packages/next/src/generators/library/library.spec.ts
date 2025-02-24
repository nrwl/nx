import { installedCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import { readJson, Tree, updateJson, writeJson } from '@nx/devkit';
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

  describe('TS solution setup', () => {
    let tree: Tree;

    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => {
        json.workspaces = ['packages/*', 'apps/*'];
        return json;
      });
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          composite: true,
          declaration: true,
        },
      });
      writeJson(tree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        files: [],
        references: [],
      });
    });

    it('should add project references when using TS solution', async () => {
      await libraryGenerator(tree, {
        directory: 'mylib',
        linter: Linter.EsLint,
        skipFormat: false,
        skipTsConfig: false,
        unitTestRunner: 'jest',
        style: 'css',
        component: false,
      });

      expect(readJson(tree, 'tsconfig.json').references).toMatchInlineSnapshot(`
        [
          {
            "path": "./mylib",
          },
        ]
      `);
      // Make sure keys are in idiomatic order
      expect(Object.keys(readJson(tree, 'mylib/package.json')))
        .toMatchInlineSnapshot(`
        [
          "name",
          "version",
          "main",
          "types",
          "exports",
          "nx",
        ]
      `);
      expect(readJson(tree, 'mylib/tsconfig.json')).toMatchInlineSnapshot(`
        {
          "extends": "../tsconfig.base.json",
          "files": [],
          "include": [],
          "references": [
            {
              "path": "./tsconfig.lib.json",
            },
            {
              "path": "./tsconfig.spec.json",
            },
          ],
        }
      `);
      expect(readJson(tree, 'mylib/tsconfig.lib.json')).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "jsx": "react-jsx",
            "module": "esnext",
            "moduleResolution": "bundler",
            "outDir": "out-tsc/mylib",
            "rootDir": "src",
            "tsBuildInfoFile": "out-tsc/mylib/tsconfig.lib.tsbuildinfo",
            "types": [
              "node",
              "@nx/react/typings/cssmodule.d.ts",
              "@nx/react/typings/image.d.ts",
              "next",
              "@nx/next/typings/image.d.ts",
            ],
          },
          "exclude": [
            "out-tsc",
            "dist",
            "jest.config.ts",
            "src/**/*.spec.ts",
            "src/**/*.test.ts",
            "src/**/*.spec.tsx",
            "src/**/*.test.tsx",
            "src/**/*.spec.js",
            "src/**/*.test.js",
            "src/**/*.spec.jsx",
            "src/**/*.test.jsx",
            "eslint.config.js",
            "eslint.config.cjs",
            "eslint.config.mjs",
          ],
          "extends": "../tsconfig.base.json",
          "include": [
            "src/**/*.js",
            "src/**/*.jsx",
            "src/**/*.ts",
            "src/**/*.tsx",
          ],
        }
      `);
      expect(readJson(tree, 'mylib/tsconfig.spec.json')).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "jsx": "react-jsx",
            "module": "esnext",
            "moduleResolution": "bundler",
            "outDir": "./out-tsc/jest",
            "types": [
              "jest",
              "node",
            ],
          },
          "extends": "../tsconfig.base.json",
          "include": [
            "jest.config.ts",
            "src/**/*.test.ts",
            "src/**/*.spec.ts",
            "src/**/*.test.tsx",
            "src/**/*.spec.tsx",
            "src/**/*.test.js",
            "src/**/*.spec.js",
            "src/**/*.test.jsx",
            "src/**/*.spec.jsx",
            "src/**/*.d.ts",
          ],
          "references": [
            {
              "path": "./tsconfig.lib.json",
            },
          ],
        }
      `);
    });

    it('should set "nx.name" in package.json when the user provides a name that is different than the package name', async () => {
      await libraryGenerator(tree, {
        directory: 'mylib',
        name: 'my-lib', // import path contains the npm scope, so it would be different
        linter: 'none',
        unitTestRunner: 'none',
        style: 'css',
        skipFormat: true,
      });

      expect(readJson(tree, 'mylib/package.json').nx).toStrictEqual({
        name: 'my-lib',
      });
    });

    it('should not set "nx.name" in package.json when the provided name matches the package name', async () => {
      await libraryGenerator(tree, {
        directory: 'mylib',
        name: '@proj/my-lib',
        linter: 'none',
        unitTestRunner: 'none',
        style: 'css',
        skipFormat: true,
      });

      expect(readJson(tree, 'mylib/package.json').nx).toBeUndefined();
    });

    it('should not set "nx.name" in package.json when the user does not provide a name', async () => {
      await libraryGenerator(tree, {
        directory: 'mylib',
        linter: 'none',
        unitTestRunner: 'none',
        style: 'css',
        skipFormat: true,
      });

      expect(readJson(tree, 'mylib/package.json').nx).toBeUndefined();
    });
  });
});
