import {
  getProjects,
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { Schema } from './schema.d';
import { libraryGenerator } from './library';

const baseLibraryConfig = {
  name: 'myLib',
  compiler: 'tsc' as const,
};

describe('lib', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  describe('not nested', () => {
    it('should update configuration', async () => {
      await libraryGenerator(tree, baseLibraryConfig);
      const configuration = readProjectConfiguration(tree, 'my-lib');
      expect(configuration.root).toEqual('libs/my-lib');
      expect(configuration.targets.build).toBeUndefined();
      expect(configuration.targets.lint).toEqual({
        executor: '@nx/linter:eslint',
        outputs: ['{options.outputFile}'],
        options: {
          lintFilePatterns: ['libs/my-lib/**/*.ts'],
        },
      });
      expect(configuration.targets.test).toEqual({
        executor: '@nx/jest:jest',
        outputs: ['{workspaceRoot}/coverage/{projectRoot}'],
        options: {
          jestConfig: 'libs/my-lib/jest.config.ts',
          passWithNoTests: true,
        },
        configurations: {
          ci: {
            ci: true,
            codeCoverage: true,
          },
        },
      });
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
        'libs/my-lib/src/index.ts',
      ]);
    });

    it('should create a local tsconfig.json', async () => {
      await libraryGenerator(tree, baseLibraryConfig);
      const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.json');
      expect(tsconfigJson).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "module": "commonjs",
          },
          "extends": "../../tsconfig.base.json",
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
      const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.spec.json');
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });

    it('should extend the local tsconfig.json with tsconfig.lib.json', async () => {
      await libraryGenerator(tree, baseLibraryConfig);
      const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.lib.json');
      expect(tsconfigJson.compilerOptions.types).toContain('node');
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });

    it('should exclude test files from tsconfig.lib.json', async () => {
      await libraryGenerator(tree, baseLibraryConfig);
      const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.lib.json');
      expect(tsconfigJson.exclude).toEqual([
        'jest.config.ts',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
      ]);
    });

    it('should generate files', async () => {
      await libraryGenerator(tree, baseLibraryConfig);
      expect(tree.exists(`libs/my-lib/jest.config.ts`)).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/index.ts')).toBeTruthy();

      const eslintrc = readJson(tree, 'libs/my-lib/.eslintrc.json');
      expect(eslintrc).toMatchInlineSnapshot(`
        {
          "extends": [
            "../../.eslintrc.json",
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
        directory: 'myDir',
        tags: 'one',
      });
      let projects = Object.fromEntries(getProjects(tree));
      expect(projects).toMatchObject({
        'my-dir-my-lib': {
          tags: ['one'],
        },
      });

      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        name: 'myLib2',
        directory: 'myDir',
        tags: 'one,two',
      });
      projects = Object.fromEntries(getProjects(tree));
      expect(projects).toMatchObject({
        'my-dir-my-lib': {
          tags: ['one'],
        },
        'my-dir-my-lib2': {
          tags: ['one', 'two'],
        },
      });
    });

    it('should generate files', async () => {
      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        directory: 'myDir',
      });
      expect(tree.exists(`libs/my-dir/my-lib/jest.config.ts`)).toBeTruthy();
      expect(tree.exists('libs/my-dir/my-lib/src/index.ts')).toBeTruthy();
    });

    it('should update workspace.json', async () => {
      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        directory: 'myDir',
      });

      const project = readProjectConfiguration(tree, 'my-dir-my-lib');
      expect(project.root).toEqual('libs/my-dir/my-lib');
      expect(project.targets.lint).toEqual({
        executor: '@nx/linter:eslint',
        outputs: ['{options.outputFile}'],
        options: {
          lintFilePatterns: ['libs/my-dir/my-lib/**/*.ts'],
        },
      });
    });

    it('should update tsconfig.json', async () => {
      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        directory: 'myDir',
      });
      const tsconfigJson = readJson(tree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-dir/my-lib']).toEqual(
        ['libs/my-dir/my-lib/src/index.ts']
      );
      expect(
        tsconfigJson.compilerOptions.paths['my-dir-my-lib/*']
      ).toBeUndefined();
    });

    it('should throw an exception when not passing importPath when using --publishable', async () => {
      expect.assertions(1);

      try {
        await libraryGenerator(tree, {
          ...baseLibraryConfig,
          directory: 'myDir',
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
        directory: 'myDir',
      });

      const tsconfigJson = readJson(tree, 'libs/my-dir/my-lib/tsconfig.json');
      expect(tsconfigJson.extends).toEqual('../../../tsconfig.base.json');
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
        directory: 'myDir',
        simpleModuleName: true,
      });
      expect(tree.exists(`libs/my-dir/my-lib/jest.config.ts`)).toBeTruthy();
      expect(tree.exists('libs/my-dir/my-lib/src/index.ts')).toBeTruthy();
      expect(tree.exists('libs/my-dir/my-lib/src/lib/my-lib.ts')).toBeTruthy();
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/my-lib.spec.ts')
      ).toBeTruthy();
      expect(tree.exists('libs/my-dir/my-lib/src/index.ts')).toBeTruthy();
      expect(tree.exists(`libs/my-dir/my-lib/.eslintrc.json`)).toBeTruthy();
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
      expect(tree.exists('libs/my-lib/tsconfig.spec.json')).toBeFalsy();
      expect(tree.exists('libs/my-lib/jest.config.ts')).toBeFalsy();
      expect(tree.exists('libs/my-lib/lib/my-lib.spec.ts')).toBeFalsy();
      expect(
        readProjectConfiguration(tree, 'my-lib').targets.test
      ).toBeUndefined();
      const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.json');
      expect(tsconfigJson.extends).toEqual('../../tsconfig.base.json');
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
      expect(projectConfiguration.root).toEqual('libs/my-lib');

      expect(projectConfiguration.targets.build).toMatchInlineSnapshot(`
        {
          "executor": "@nx/js:tsc",
          "options": {
            "assets": [
              "libs/my-lib/*.md",
            ],
            "main": "libs/my-lib/src/index.ts",
            "outputPath": "dist/libs/my-lib",
            "packageJson": "libs/my-lib/package.json",
            "tsConfig": "libs/my-lib/tsconfig.lib.json",
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
      expect(projectConfiguration.root).toEqual('libs/my-lib');
      expect(projectConfiguration.targets.build).toBeDefined();
    });

    it('should update package.json', async () => {
      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        name: 'mylib',
        publishable: true,
        importPath: '@proj/mylib',
      });

      let packageJsonContent = readJson(tree, 'libs/mylib/package.json');

      expect(packageJsonContent.name).toEqual('@proj/mylib');
    });
  });

  describe('--importPath', () => {
    it('should update the package.json & tsconfig with the given import path', async () => {
      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        publishable: true,
        directory: 'myDir',
        importPath: '@myorg/lib',
      });
      const packageJson = readJson(tree, 'libs/my-dir/my-lib/package.json');
      const tsconfigJson = readJson(tree, '/tsconfig.base.json');

      expect(packageJson.name).toBe('@myorg/lib');
      expect(
        tsconfigJson.compilerOptions.paths[packageJson.name]
      ).toBeDefined();
    });

    it('should fail if the same importPath has already been used', async () => {
      await libraryGenerator(tree, {
        ...baseLibraryConfig,
        name: 'myLib1',
        publishable: true,
        importPath: '@myorg/lib',
      });

      try {
        await libraryGenerator(tree, {
          ...baseLibraryConfig,
          name: 'myLib2',
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
        name: 'myLib',
        babelJest: true,
      } as Schema);

      expect(tree.read(`libs/my-lib/jest.config.ts`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "/* eslint-disable */
        export default {
          displayName: 'my-lib',
          preset: '../../jest.preset.js',
          testEnvironment: 'node',
          transform: {
            '^.+\\\\.[tj]s$': 'babel-jest',
          },
          moduleFileExtensions: ['ts', 'js', 'html'],
          coverageDirectory: '../../coverage/libs/my-lib',
        };
        "
      `);
    });
  });
  describe('--js flag', () => {
    it('should generate js files instead of ts files', async () => {
      await libraryGenerator(tree, {
        name: 'myLib',
        js: true,
      } as Schema);

      expect(tree.exists(`libs/my-lib/jest.config.js`)).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/index.js')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.js')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.spec.js')).toBeTruthy();

      expect(
        readJson(tree, 'libs/my-lib/tsconfig.json').compilerOptions
      ).toEqual({
        allowJs: true,
        module: 'commonjs',
      });
      expect(readJson(tree, 'libs/my-lib/tsconfig.lib.json').include).toEqual([
        'src/**/*.ts',
        'src/**/*.js',
      ]);
      expect(readJson(tree, 'libs/my-lib/tsconfig.lib.json').exclude).toEqual([
        'jest.config.ts',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.js',
        'src/**/*.test.js',
      ]);
    });

    it('should update root tsconfig.json with a js file path', async () => {
      await libraryGenerator(tree, { name: 'myLib', js: true } as Schema);
      const tsconfigJson = readJson(tree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'libs/my-lib/src/index.js',
      ]);
    });

    it('should update architect builder when --buildable', async () => {
      await libraryGenerator(tree, {
        name: 'myLib',
        buildable: true,
        js: true,
      } as Schema);

      const projectConfiguration = readProjectConfiguration(tree, 'my-lib');
      expect(projectConfiguration.root).toEqual('libs/my-lib');

      expect(projectConfiguration.targets.build.options.main).toEqual(
        'libs/my-lib/src/index.js'
      );
    });

    it('should generate js files for nested libs as well', async () => {
      await libraryGenerator(tree, {
        name: 'myLib',
        directory: 'myDir',
        js: true,
      } as Schema);
      expect(tree.exists(`libs/my-dir/my-lib/jest.config.js`)).toBeTruthy();
      expect(tree.exists('libs/my-dir/my-lib/src/index.js')).toBeTruthy();
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.js')
      ).toBeTruthy();
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.spec.js')
      ).toBeTruthy();
    });
  });

  describe('--pascalCaseFiles', () => {
    it('should generate files with upper case names', async () => {
      await libraryGenerator(tree, {
        name: 'myLib',
        pascalCaseFiles: true,
      } as Schema);
      expect(tree.exists('libs/my-lib/src/lib/MyLib.ts')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/MyLib.spec.ts')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.spec.ts')).toBeFalsy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.ts')).toBeFalsy();
    });

    it('should generate files with upper case names for nested libs as well', async () => {
      await libraryGenerator(tree, {
        name: 'myLib',
        directory: 'myDir',
        pascalCaseFiles: true,
      } as Schema);
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/MyDirMyLib.ts')
      ).toBeTruthy();
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/MyDirMyLib.spec.ts')
      ).toBeTruthy();
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.ts')
      ).toBeFalsy();
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.spec.ts')
      ).toBeFalsy();
    });
  });
});
