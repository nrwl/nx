import { getProjects, readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { Schema } from './schema.d';
import { libraryGenerator } from './library';

describe('lib', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('not nested', () => {
    it('should update workspace.json', async () => {
      await libraryGenerator(tree, { name: 'myLib', standaloneConfig: false });
      const workspaceJson = readJson(tree, '/workspace.json');
      expect(workspaceJson.projects['my-lib'].root).toEqual('libs/my-lib');
      expect(workspaceJson.projects['my-lib'].architect.build).toBeUndefined();
      expect(workspaceJson.projects['my-lib'].architect.lint).toEqual({
        builder: '@nrwl/linter:eslint',
        outputs: ['{options.outputFile}'],
        options: {
          lintFilePatterns: ['libs/my-lib/**/*.ts'],
        },
      });
      expect(workspaceJson.projects['my-lib'].architect.test).toEqual({
        builder: '@nrwl/jest:jest',
        outputs: ['coverage/libs/my-lib'],
        options: {
          jestConfig: 'libs/my-lib/jest.config.js',
          passWithNoTests: true,
        },
      });
    });

    it('adds srcRootForCompilationRoot in workspace.json', async () => {
      await libraryGenerator(tree, {
        name: 'myLib',
        rootDir: './src',
        buildable: true,
        standaloneConfig: false,
      });
      const workspaceJson = readJson(tree, '/workspace.json');
      expect(
        workspaceJson.projects['my-lib'].architect.build.options
          .srcRootForCompilationRoot
      ).toEqual('./src');
    });

    it('should update tags', async () => {
      await libraryGenerator(tree, {
        name: 'myLib',
        tags: 'one,two',
        standaloneConfig: false,
      });
      const projects = Object.fromEntries(getProjects(tree));
      expect(projects).toMatchObject({
        'my-lib': {
          tags: ['one', 'two'],
        },
      });
    });

    it('should update root tsconfig.base.json', async () => {
      await libraryGenerator(tree, { name: 'myLib', standaloneConfig: false });
      const tsconfigJson = readJson(tree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'libs/my-lib/src/index.ts',
      ]);
    });

    it('should create a local tsconfig.json', async () => {
      await libraryGenerator(tree, { name: 'myLib', standaloneConfig: false });
      const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.json');
      expect(tsconfigJson).toMatchInlineSnapshot(`
        Object {
          "extends": "../../tsconfig.base.json",
          "files": Array [],
          "include": Array [],
          "references": Array [
            Object {
              "path": "./tsconfig.lib.json",
            },
            Object {
              "path": "./tsconfig.spec.json",
            },
          ],
        }
      `);
    });

    it('should extend the local tsconfig.json with tsconfig.spec.json', async () => {
      await libraryGenerator(tree, { name: 'myLib', standaloneConfig: false });
      const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.spec.json');
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });

    it('should extend the local tsconfig.json with tsconfig.lib.json', async () => {
      await libraryGenerator(tree, { name: 'myLib', standaloneConfig: false });
      const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.lib.json');
      expect(tsconfigJson.compilerOptions.types).toContain('node');
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });

    it('should exclude test files from tsconfig.lib.json', async () => {
      await libraryGenerator(tree, { name: 'myLib', standaloneConfig: false });
      const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.lib.json');
      expect(tsconfigJson.exclude).toEqual(['**/*.spec.ts', '**/*.test.ts']);
    });

    it('should generate files', async () => {
      await libraryGenerator(tree, { name: 'myLib', standaloneConfig: false });
      expect(tree.exists(`libs/my-lib/jest.config.js`)).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/index.ts')).toBeTruthy();

      const eslintrc = readJson(tree, 'libs/my-lib/.eslintrc.json');
      expect(eslintrc).toMatchInlineSnapshot(`
        Object {
          "extends": Array [
            "../../.eslintrc.json",
          ],
          "ignorePatterns": Array [
            "!**/*",
          ],
          "overrides": Array [
            Object {
              "files": Array [
                "*.ts",
                "*.tsx",
                "*.js",
                "*.jsx",
              ],
              "rules": Object {},
            },
            Object {
              "files": Array [
                "*.ts",
                "*.tsx",
              ],
              "rules": Object {},
            },
            Object {
              "files": Array [
                "*.js",
                "*.jsx",
              ],
              "rules": Object {},
            },
          ],
        }
      `);
    });
  });

  describe('nested', () => {
    it('should update tags', async () => {
      await libraryGenerator(tree, {
        name: 'myLib',
        directory: 'myDir',
        tags: 'one',
        standaloneConfig: false,
      });
      let projects = Object.fromEntries(getProjects(tree));
      expect(projects).toMatchObject({
        'my-dir-my-lib': {
          tags: ['one'],
        },
      });

      await libraryGenerator(tree, {
        name: 'myLib2',
        directory: 'myDir',
        tags: 'one,two',
        standaloneConfig: false,
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
        name: 'myLib',
        directory: 'myDir',
        standaloneConfig: false,
      });
      expect(tree.exists(`libs/my-dir/my-lib/jest.config.js`)).toBeTruthy();
      expect(tree.exists('libs/my-dir/my-lib/src/index.ts')).toBeTruthy();
    });

    it('should update workspace.json', async () => {
      await libraryGenerator(tree, {
        name: 'myLib',
        directory: 'myDir',
        standaloneConfig: false,
      });
      const workspaceJson = readJson(tree, '/workspace.json');

      expect(workspaceJson.projects['my-dir-my-lib'].root).toEqual(
        'libs/my-dir/my-lib'
      );
      expect(workspaceJson.projects['my-dir-my-lib'].architect.lint).toEqual({
        builder: '@nrwl/linter:eslint',
        outputs: ['{options.outputFile}'],
        options: {
          lintFilePatterns: ['libs/my-dir/my-lib/**/*.ts'],
        },
      });
    });

    it('should update tsconfig.json', async () => {
      await libraryGenerator(tree, {
        name: 'myLib',
        directory: 'myDir',
        standaloneConfig: false,
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
          name: 'myLib',
          directory: 'myDir',
          publishable: true,
          standaloneConfig: false,
        });
      } catch (e) {
        expect(e.message).toContain(
          'For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)'
        );
      }
    });

    it('should create a local tsconfig.json', async () => {
      await libraryGenerator(tree, {
        name: 'myLib',
        directory: 'myDir',
        standaloneConfig: false,
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
        name: 'myLib',
        directory: 'myDir',
        simpleModuleName: true,
        standaloneConfig: false,
      });
      expect(tree.exists(`libs/my-dir/my-lib/jest.config.js`)).toBeTruthy();
      expect(tree.exists('libs/my-dir/my-lib/src/index.ts')).toBeTruthy();
      expect(tree.exists('libs/my-dir/my-lib/src/lib/my-lib.ts')).toBeTruthy();
      expect(
        tree.exists('libs/my-dir/my-lib/src/lib/my-lib.spec.ts')
      ).toBeTruthy();
      expect(tree.exists('libs/my-dir/my-lib/src/index.ts')).toBeTruthy();
      expect(tree.exists(`libs/my-dir/my-lib/.eslintrc.json`)).toBeTruthy();
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await libraryGenerator(tree, {
        name: 'myLib',
        unitTestRunner: 'none',
        standaloneConfig: false,
      });
      expect(tree.exists('libs/my-lib/tsconfig.spec.json')).toBeFalsy();
      expect(tree.exists('libs/my-lib/jest.config.js')).toBeFalsy();
      expect(tree.exists('libs/my-lib/lib/my-lib.spec.ts')).toBeFalsy();
      const workspaceJson = readJson(tree, 'workspace.json');
      expect(workspaceJson.projects['my-lib'].architect.test).toBeUndefined();
      const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.json');
      expect(tsconfigJson.extends).toEqual('../../tsconfig.base.json');
      expect(tsconfigJson.references).toEqual([
        {
          path: './tsconfig.lib.json',
        },
      ]);
      expect(workspaceJson.projects['my-lib'].architect.lint)
        .toMatchInlineSnapshot(`
        Object {
          "builder": "@nrwl/linter:eslint",
          "options": Object {
            "lintFilePatterns": Array [
              "libs/my-lib/**/*.ts",
            ],
          },
          "outputs": Array [
            "{options.outputFile}",
          ],
        }
      `);
    });
  });

  describe('buildable package', () => {
    it('should have a builder defined', async () => {
      await libraryGenerator(tree, {
        name: 'myLib',
        buildable: true,
        standaloneConfig: false,
      });
      const workspaceJson = readJson(tree, '/workspace.json');

      expect(workspaceJson.projects['my-lib'].root).toEqual('libs/my-lib');

      expect(workspaceJson.projects['my-lib'].architect.build)
        .toMatchInlineSnapshot(`
        Object {
          "builder": "@nrwl/node:package",
          "options": Object {
            "assets": Array [
              "libs/my-lib/*.md",
            ],
            "main": "libs/my-lib/src/index.ts",
            "outputPath": "dist/libs/my-lib",
            "packageJson": "libs/my-lib/package.json",
            "tsConfig": "libs/my-lib/tsconfig.lib.json",
          },
          "outputs": Array [
            "{options.outputPath}",
          ],
        }
      `);
    });
  });

  describe('publishable package', () => {
    it('should have a builder defined', async () => {
      await libraryGenerator(tree, {
        name: 'myLib',
        publishable: true,
        importPath: '@proj/mylib',
        standaloneConfig: false,
      });
      const workspaceJson = readJson(tree, '/workspace.json');

      expect(workspaceJson.projects['my-lib'].root).toEqual('libs/my-lib');

      expect(workspaceJson.projects['my-lib'].architect.build).toBeDefined();
    });

    it('should update package.json', async () => {
      await libraryGenerator(tree, {
        name: 'mylib',
        publishable: true,
        importPath: '@proj/mylib',
        standaloneConfig: false,
      });

      let packageJsonContent = readJson(tree, 'libs/mylib/package.json');

      expect(packageJsonContent.name).toEqual('@proj/mylib');
    });
  });

  describe('--importPath', () => {
    it('should update the package.json & tsconfig with the given import path', async () => {
      await libraryGenerator(tree, {
        name: 'myLib',
        publishable: true,
        directory: 'myDir',
        importPath: '@myorg/lib',
        standaloneConfig: false,
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
        name: 'myLib1',
        publishable: true,
        importPath: '@myorg/lib',
        standaloneConfig: false,
      });

      try {
        await libraryGenerator(tree, {
          name: 'myLib2',
          publishable: true,
          importPath: '@myorg/lib',
          standaloneConfig: false,
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

      expect(tree.read(`libs/my-lib/jest.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "module.exports = {
          displayName: 'my-lib',
          preset: '../../jest.preset.js',
          testEnvironment: 'node',
          transform: {
            '^.+\\\\\\\\.[tj]sx?$': 'babel-jest'
          },
            moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
          coverageDirectory: '../../coverage/libs/my-lib'
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
      });
      expect(readJson(tree, 'libs/my-lib/tsconfig.lib.json').include).toEqual([
        '**/*.ts',
        '**/*.js',
      ]);
      expect(readJson(tree, 'libs/my-lib/tsconfig.lib.json').exclude).toEqual([
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/*.spec.js',
        '**/*.test.js',
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
      const workspaceJson = readJson(tree, '/workspace.json');

      expect(workspaceJson.projects['my-lib'].root).toEqual('libs/my-lib');

      expect(
        workspaceJson.projects['my-lib'].architect.build.options.main
      ).toEqual('libs/my-lib/src/index.js');
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

  describe('--experimentalSwc', () => {
    it('should set  build.options.experimentalSwc to true for buildable', async () => {
      await libraryGenerator(tree, {
        name: 'mySwcLib',
        buildable: true,
        experimentalSwc: true,
      });

      const workspaceJson = readJson(tree, '/workspace.json');
      const project = workspaceJson.projects['my-swc-lib'];
      const buildTarget = project.architect.build;

      expect(buildTarget.options.experimentalSwc).toEqual(true);
    });
  });
});
