import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  getProjects,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { Schema } from './schema.d';
import { libraryGenerator } from './library';

const baseLibraryConfig = {
  directory: 'my-lib',
  compiler: 'tsc' as const,
  addPlugin: true,
};

describe('lib', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('not nested', () => {
    it('should update configuration', async () => {
      await libraryGenerator(tree, baseLibraryConfig);
      const configuration = readProjectConfiguration(tree, 'my-lib');
      expect(configuration.root).toEqual('my-lib');
      expect(configuration.targets.build).toBeUndefined();
      expect(tree.read('my-lib/jest.config.ts', 'utf-8')).toMatchSnapshot();
      expect(
        readJson(tree, 'package.json').devDependencies['jest-environment-jsdom']
      ).not.toBeDefined();
      expect(
        readJson(tree, 'package.json').devDependencies['jest-environment-node']
      ).toBeDefined();
    });

    it('adds srcRootForCompilationRoot', async () => {
      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        rootDir: './src',
        buildable: true,
      });
      expect(
        readProjectConfiguration(tree, 'my-lib').targets.build.options
          .srcRootForCompilationRoot
      ).toEqual('./src');
    });

    it('should update tags', async () => {
      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        tags: 'one,two',
      });
      const projects = Object.fromEntries(getProjects(tree));
      expect(projects).toMatchObject({
        'my-lib': {
          tags: ['one', 'two'],
        },
      });
    });

    it('should update root tsconfig.base.json', async () => {
      await libraryGenerator(tree, baseLibraryConfig);
      const tsconfigJson = readJson(tree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'my-lib/src/index.ts',
      ]);
    });

    it('should create a local tsconfig.json', async () => {
      await libraryGenerator(tree, baseLibraryConfig);
      const tsconfigJson = readJson(tree, 'my-lib/tsconfig.json');
      expect(tsconfigJson).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "module": "commonjs",
          },
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
    });

    it('should extend the local tsconfig.json with tsconfig.spec.json', async () => {
      await libraryGenerator(tree, baseLibraryConfig);
      const tsconfigJson = readJson(tree, 'my-lib/tsconfig.spec.json');
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });

    it('should extend the local tsconfig.json with tsconfig.lib.json', async () => {
      await libraryGenerator(tree, baseLibraryConfig);
      const tsconfigJson = readJson(tree, 'my-lib/tsconfig.lib.json');
      expect(tsconfigJson.compilerOptions.types).toContain('node');
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });

    it('should exclude test files from tsconfig.lib.json', async () => {
      await libraryGenerator(tree, baseLibraryConfig);
      const tsconfigJson = readJson(tree, 'my-lib/tsconfig.lib.json');
      expect(tsconfigJson.exclude).toEqual([
        'jest.config.ts',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
      ]);
    });

    it('should generate files', async () => {
      await libraryGenerator(tree, baseLibraryConfig);
      expect(tree.exists(`my-lib/jest.config.ts`)).toBeTruthy();
      expect(tree.exists('my-lib/src/index.ts')).toBeTruthy();

      const eslintrc = readJson(tree, 'my-lib/.eslintrc.json');
      expect(eslintrc).toMatchInlineSnapshot(`
        {
          "extends": [
            "../.eslintrc.json",
          ],
          "ignorePatterns": [
            "!**/*",
          ],
          "overrides": [
            {
              "files": [
                "*.ts",
                "*.tsx",
                "*.js",
                "*.jsx",
              ],
              "rules": {},
            },
            {
              "files": [
                "*.ts",
                "*.tsx",
              ],
              "rules": {},
            },
            {
              "files": [
                "*.js",
                "*.jsx",
              ],
              "rules": {},
            },
          ],
        }
      `);
    });
  });

  describe('nested', () => {
    it('should update tags', async () => {
      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        directory: 'my-dir/my-lib',
        tags: 'one',
      });
      let projects = Object.fromEntries(getProjects(tree));
      expect(projects).toMatchObject({
        'my-lib': {
          tags: ['one'],
        },
      });

      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        name: 'my-lib2',
        directory: 'my-dir/my-lib-2',
        tags: 'one,two',
      });
      projects = Object.fromEntries(getProjects(tree));
      expect(projects).toMatchObject({
        'my-lib': {
          tags: ['one'],
        },
        'my-lib2': {
          tags: ['one', 'two'],
        },
      });
    });

    it('should generate files', async () => {
      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        directory: 'my-dir/my-lib',
      });
      expect(tree.exists(`my-dir/my-lib/jest.config.ts`)).toBeTruthy();
      expect(tree.exists('my-dir/my-lib/src/index.ts')).toBeTruthy();
    });

    it('should update project.json', async () => {
      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        directory: 'my-dir/my-lib',
      });

      const project = readProjectConfiguration(tree, 'my-lib');
      expect(project).toMatchInlineSnapshot(`
        {
          "$schema": "../../node_modules/nx/schemas/project-schema.json",
          "name": "my-lib",
          "projectType": "library",
          "root": "my-dir/my-lib",
          "sourceRoot": "my-dir/my-lib/src",
          "tags": [],
          "targets": {},
        }
      `);
    });

    it('should update tsconfig.json', async () => {
      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        directory: 'my-dir/my-lib',
      });
      const tsconfigJson = readJson(tree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'my-dir/my-lib/src/index.ts',
      ]);
      expect(tsconfigJson.compilerOptions.paths['my-lib/*']).toBeUndefined();
    });

    it('should throw an exception when not passing importPath when using --publishable', async () => {
      expect.assertions(1);

      try {
        await libraryGenerator(tree, {
          ...baseLibraryConfig,
          directory: 'my-dir/my-lib',
          publishable: true,
        });
      } catch (e) {
        expect(e.message).toContain(
          'For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)'
        );
      }
    });

    it('should create a local tsconfig.json', async () => {
      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        directory: 'my-dir/my-lib',
      });

      const tsconfigJson = readJson(tree, 'my-dir/my-lib/tsconfig.json');
      expect(tsconfigJson.extends).toEqual('../../tsconfig.base.json');
      expect(tsconfigJson.references).toEqual([
        {
          path: './tsconfig.lib.json',
        },
        {
          path: './tsconfig.spec.json',
        },
      ]);
    });

    it('should generate filenames that do not contain directory with --simpleModuleName', async () => {
      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        directory: 'my-dir/my-lib',
        simpleModuleName: true,
      });
      expect(tree.exists(`my-dir/my-lib/jest.config.ts`)).toBeTruthy();
      expect(tree.exists('my-dir/my-lib/src/index.ts')).toBeTruthy();
      expect(tree.exists('my-dir/my-lib/src/lib/my-lib.ts')).toBeTruthy();
      expect(tree.exists('my-dir/my-lib/src/lib/my-lib.spec.ts')).toBeTruthy();
      expect(tree.exists('my-dir/my-lib/src/index.ts')).toBeTruthy();
      expect(tree.exists(`my-dir/my-lib/.eslintrc.json`)).toBeTruthy();
    });
  });

  describe('--compiler', () => {
    it('should specify tsc as compiler', async () => {
      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        compiler: 'tsc',
        buildable: true,
      });

      const { build } = readProjectConfiguration(tree, 'my-lib').targets;

      expect(build.executor).toEqual('@nx/js:tsc');
    });

    it('should specify swc as compiler', async () => {
      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        compiler: 'swc',
        buildable: true,
      });

      const { build } = readProjectConfiguration(tree, 'my-lib').targets;

      expect(build.executor).toEqual('@nx/js:swc');
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        unitTestRunner: 'none',
      });
      expect(tree.exists('my-lib/tsconfig.spec.json')).toBeFalsy();
      expect(tree.exists('my-lib/jest.config.ts')).toBeFalsy();
      expect(tree.exists('my-lib/lib/my-lib.spec.ts')).toBeFalsy();
      expect(
        readProjectConfiguration(tree, 'my-lib').targets.test
      ).toBeUndefined();
      const tsconfigJson = readJson(tree, 'my-lib/tsconfig.json');
      expect(tsconfigJson.extends).toEqual('../tsconfig.base.json');
      expect(tsconfigJson.references).toEqual([
        {
          path: './tsconfig.lib.json',
        },
      ]);
    });
  });

  describe('buildable package', () => {
    it('should have a builder defined', async () => {
      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        buildable: true,
      });

      const projectConfiguration = readProjectConfiguration(tree, 'my-lib');
      expect(projectConfiguration.root).toEqual('my-lib');

      expect(projectConfiguration.targets.build).toMatchInlineSnapshot(`
        {
          "executor": "@nx/js:tsc",
          "options": {
            "assets": [
              "my-lib/*.md",
            ],
            "main": "my-lib/src/index.ts",
            "outputPath": "dist/my-lib",
            "packageJson": "my-lib/package.json",
            "tsConfig": "my-lib/tsconfig.lib.json",
          },
          "outputs": [
            "{options.outputPath}",
          ],
        }
      `);
    });
  });

  describe('publishable package', () => {
    it('should have a builder defined', async () => {
      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        publishable: true,
        importPath: '@proj/mylib',
      });

      const projectConfiguration = readProjectConfiguration(tree, 'my-lib');
      expect(projectConfiguration.root).toEqual('my-lib');
      expect(projectConfiguration.targets.build).toBeDefined();
    });

    it('should update package.json', async () => {
      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        directory: 'mylib',
        publishable: true,
        importPath: '@proj/mylib',
      });

      let packageJsonContent = readJson(tree, 'mylib/package.json');

      expect(packageJsonContent.name).toEqual('@proj/mylib');
    });
  });

  describe('--importPath', () => {
    it('should update the package.json & tsconfig with the given import path', async () => {
      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        publishable: true,
        directory: 'my-dir/my-lib',
        importPath: '@myorg/lib',
      });
      const packageJson = readJson(tree, 'my-dir/my-lib/package.json');
      const tsconfigJson = readJson(tree, '/tsconfig.base.json');

      expect(packageJson.name).toBe('@myorg/lib');
      expect(
        tsconfigJson.compilerOptions.paths[packageJson.name]
      ).toBeDefined();
    });

    it('should fail if the same importPath has already been used', async () => {
      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        directory: 'my-lib1',
        publishable: true,
        importPath: '@myorg/lib',
      });

      try {
        await libraryGenerator(tree, {
          ...baseLibraryConfig,
          directory: 'my-lib2',
          publishable: true,
          importPath: '@myorg/lib',
        });
      } catch (e) {
        expect(e.message).toContain(
          'You already have a library using the import path'
        );
      }

      expect.assertions(1);
    });
  });

  describe(`--babelJest`, () => {
    it('should use babel for jest', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
        babelJest: true,
      } as Schema);

      expect(tree.read(`my-lib/jest.config.ts`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "export default {
          displayName: 'my-lib',
          preset: '../jest.preset.js',
          testEnvironment: 'node',
          transform: {
            '^.+\\\\.[tj]s$': 'babel-jest',
          },
          moduleFileExtensions: ['ts', 'js', 'html'],
          coverageDirectory: '../coverage/my-lib',
        };
        "
      `);
    });
  });
  describe('--js flag', () => {
    it('should generate js files instead of ts files', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
        js: true,
      } as Schema);

      expect(tree.exists(`my-lib/jest.config.js`)).toBeTruthy();
      expect(tree.exists('my-lib/src/index.js')).toBeTruthy();
      expect(tree.exists('my-lib/src/lib/my-lib.js')).toBeTruthy();
      expect(tree.exists('my-lib/src/lib/my-lib.spec.js')).toBeTruthy();

      expect(readJson(tree, 'my-lib/tsconfig.json').compilerOptions).toEqual({
        allowJs: true,
        module: 'commonjs',
      });
      expect(readJson(tree, 'my-lib/tsconfig.lib.json').include).toEqual([
        'src/**/*.ts',
        'src/**/*.js',
      ]);
      expect(readJson(tree, 'my-lib/tsconfig.lib.json').exclude).toEqual([
        'jest.config.js',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.js',
        'src/**/*.test.js',
      ]);
    });

    it('should update root tsconfig.json with a js file path', async () => {
      await libraryGenerator(tree, { directory: 'my-lib', js: true } as Schema);
      const tsconfigJson = readJson(tree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'my-lib/src/index.js',
      ]);
    });

    it('should update architect builder when --buildable', async () => {
      await libraryGenerator(tree, {
        directory: 'my-lib',
        buildable: true,
        js: true,
      } as Schema);

      const projectConfiguration = readProjectConfiguration(tree, 'my-lib');
      expect(projectConfiguration.root).toEqual('my-lib');

      expect(projectConfiguration.targets.build.options.main).toEqual(
        'my-lib/src/index.js'
      );
    });

    it('should generate js files for nested libs as well', async () => {
      await libraryGenerator(tree, {
        name: 'my-lib',
        directory: 'my-dir/my-lib',
        js: true,
      } as Schema);
      expect(tree.exists(`my-dir/my-lib/jest.config.js`)).toBeTruthy();
      expect(tree.exists('my-dir/my-lib/src/index.js')).toBeTruthy();
      expect(tree.exists('my-dir/my-lib/src/lib/my-lib.js')).toBeTruthy();
      expect(tree.exists('my-dir/my-lib/src/lib/my-lib.spec.js')).toBeTruthy();
    });
  });

  describe('TS solution setup', () => {
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
        unitTestRunner: 'jest',
        addPlugin: true,
      } as Schema);

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
          "private",
          "main",
          "types",
          "exports",
          "dependencies",
        ]
      `);
      expect(readJson(tree, 'mylib/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {},
          "exports": {
            ".": {
              "default": "./src/index.ts",
              "import": "./src/index.ts",
              "types": "./src/index.ts",
            },
            "./package.json": "./package.json",
          },
          "main": "./src/index.ts",
          "name": "@proj/mylib",
          "private": true,
          "types": "./src/index.ts",
          "version": "0.0.1",
        }
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
            "baseUrl": ".",
            "emitDeclarationOnly": true,
            "module": "nodenext",
            "moduleResolution": "nodenext",
            "outDir": "dist",
            "rootDir": "src",
            "tsBuildInfoFile": "dist/tsconfig.lib.tsbuildinfo",
            "types": [
              "node",
            ],
          },
          "exclude": [
            "jest.config.ts",
            "src/**/*.spec.ts",
            "src/**/*.test.ts",
          ],
          "extends": "../tsconfig.base.json",
          "include": [
            "src/**/*.ts",
          ],
          "references": [],
        }
      `);
      expect(readJson(tree, 'mylib/tsconfig.spec.json')).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "module": "nodenext",
            "moduleResolution": "nodenext",
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

    it('should set correct options for swc', async () => {
      await libraryGenerator(tree, {
        directory: 'mylib',
        buildable: true,
        compiler: 'swc',
        unitTestRunner: 'jest',
        addPlugin: true,
      } as Schema);

      expect(readJson(tree, 'mylib/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {
            "tslib": "^2.3.0",
          },
          "exports": {
            ".": {
              "default": "./dist/index.js",
              "import": "./dist/index.js",
              "types": "./dist/index.d.ts",
            },
            "./package.json": "./package.json",
          },
          "main": "./dist/index.js",
          "module": "./dist/index.js",
          "name": "@proj/mylib",
          "nx": {
            "targets": {
              "build": {
                "executor": "@nx/js:swc",
                "options": {
                  "main": "mylib/src/index.ts",
                  "outputPath": "mylib/dist",
                  "packageJson": "mylib/package.json",
                  "stripLeadingPaths": true,
                  "tsConfig": "mylib/tsconfig.lib.json",
                },
                "outputs": [
                  "{options.outputPath}",
                ],
              },
            },
          },
          "private": true,
          "types": "./dist/index.d.ts",
          "version": "0.0.1",
        }
      `);
    });

    it('should set "nx.name" in package.json when the user provides a name that is different than the package name', async () => {
      await libraryGenerator(tree, {
        directory: 'mylib',
        name: 'my-lib',
        linter: 'none',
        unitTestRunner: 'none',
        addPlugin: true,
        skipFormat: true,
      } as Schema);

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
        addPlugin: true,
        skipFormat: true,
      } as Schema);

      expect(readJson(tree, 'mylib/package.json').nx).toBeUndefined();
    });

    it('should not set "nx.name" in package.json when the user does not provide a name', async () => {
      await libraryGenerator(tree, {
        directory: 'mylib',
        linter: 'none',
        unitTestRunner: 'none',
        addPlugin: true,
        skipFormat: true,
      } as Schema);

      expect(readJson(tree, 'mylib/package.json').nx).toBeUndefined();
    });
  });
});
