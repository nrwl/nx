import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  getPackageManagerCommand,
  getProjects,
  output,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { LibraryGeneratorSchema } from '../../utils/schema';
import libraryGenerator from './library';

describe('lib', () => {
  let tree: Tree;
  const defaultOptions: Omit<LibraryGeneratorSchema, 'name'> = {
    skipTsConfig: false,
    includeBabelRc: false,
    unitTestRunner: 'jest',
    skipFormat: false,
    linter: 'eslint',
    testEnvironment: 'jsdom',
    js: false,
    pascalCaseFiles: false,
    strict: true,
    config: 'project',
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('/.gitignore', '');
    tree.write('/.gitignore', '');
  });

  describe('configs', () => {
    it('should generate an empty ts lib using --config=npm-scripts', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'my-lib',
        config: 'npm-scripts',
        projectNameAndRootFormat: 'as-provided',
      });
      expect(readJson(tree, '/my-lib/package.json')).toEqual({
        name: '@proj/my-lib',
        private: true,
        version: '0.0.1',
        scripts: {
          build: "echo 'implement build'",
          test: "echo 'implement test'",
        },
        dependencies: {},
      });

      expect(tree.exists('my-lib/src/index.ts')).toBeTruthy();
      expect(tree.exists('my-lib/src/lib/my-lib.ts')).toBeTruthy();

      // unitTestRunner property is ignored.
      // It only works with our executors.
      expect(tree.exists('my-lib/src/lib/my-lib.spec.ts')).toBeFalsy();
    });

    it('should generate an empty ts lib using --config=project', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'my-lib',
        config: 'project',
        projectNameAndRootFormat: 'as-provided',
      });
      const projectConfig = readProjectConfiguration(tree, 'my-lib');
      expect(projectConfig.root).toEqual('my-lib');
    });

    it('should generate an empty ts lib using --config=workspace', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'my-lib',
        config: 'workspace',
        projectNameAndRootFormat: 'as-provided',
      });
      const projectConfig = readProjectConfiguration(tree, 'my-lib');
      expect(projectConfig.root).toEqual('my-lib');
    });
  });

  describe('shared options', () => {
    describe('not-nested', () => {
      it('should update tags', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          tags: 'one,two',
          projectNameAndRootFormat: 'as-provided',
        });
        const projects = Object.fromEntries(getProjects(tree));
        expect(projects).toMatchObject({
          'my-lib': {
            tags: ['one', 'two'],
          },
        });
      });

      it('should update root tsconfig.base.json', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          projectNameAndRootFormat: 'as-provided',
        });
        const tsconfigJson = readJson(tree, '/tsconfig.base.json');
        expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
          'my-lib/src/index.ts',
        ]);
      });

      it('should update root tsconfig.json when no tsconfig.base.json', async () => {
        tree.rename('tsconfig.base.json', 'tsconfig.json');

        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          projectNameAndRootFormat: 'as-provided',
        });

        const tsconfigJson = readJson(tree, 'tsconfig.json');
        expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
          'my-lib/src/index.ts',
        ]);
      });

      it('should update root tsconfig.base.json (no existing path mappings)', async () => {
        updateJson(tree, 'tsconfig.base.json', (json) => {
          json.compilerOptions.paths = undefined;
          return json;
        });

        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          projectNameAndRootFormat: 'as-provided',
        });
        const tsconfigJson = readJson(tree, '/tsconfig.base.json');
        expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
          'my-lib/src/index.ts',
        ]);
      });

      it('should create a local tsconfig.json', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          projectNameAndRootFormat: 'as-provided',
        });
        const tsconfigJson = readJson(tree, 'my-lib/tsconfig.json');
        expect(tsconfigJson).toMatchInlineSnapshot(`
          {
            "compilerOptions": {
              "forceConsistentCasingInFileNames": true,
              "module": "commonjs",
              "noFallthroughCasesInSwitch": true,
              "noImplicitOverride": true,
              "noImplicitReturns": true,
              "noPropertyAccessFromIndexSignature": true,
              "strict": true,
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

      it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
        tree.rename('tsconfig.base.json', 'tsconfig.json');

        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          projectNameAndRootFormat: 'as-provided',
        });

        const tsconfigJson = readJson(tree, 'my-lib/tsconfig.json');
        expect(tsconfigJson.extends).toBe('../tsconfig.json');
      });
    });

    describe('nested', () => {
      it('should update tags', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          directory: 'my-dir/my-lib',
          tags: 'one',
          projectNameAndRootFormat: 'as-provided',
        });
        let projects = Object.fromEntries(getProjects(tree));
        expect(projects).toMatchObject({
          'my-lib': {
            tags: ['one'],
          },
        });

        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib2',
          directory: 'my-dir/my-lib-2',
          tags: 'one,two',
          projectNameAndRootFormat: 'as-provided',
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
          ...defaultOptions,
          name: 'my-lib',
          directory: 'my-dir/my-lib',
          projectNameAndRootFormat: 'as-provided',
        });
        expect(tree.exists(`my-dir/my-lib/jest.config.ts`)).toBeTruthy();
        expect(tree.exists('my-dir/my-lib/src/index.ts')).toBeTruthy();
        expect(tree.exists('my-dir/my-lib/src/lib/my-lib.ts')).toBeTruthy();
        expect(
          tree.exists('my-dir/my-lib/src/lib/my-lib.spec.ts')
        ).toBeTruthy();
        expect(tree.exists('my-dir/my-lib/src/index.ts')).toBeTruthy();
        expect(tree.exists(`my-dir/my-lib/.eslintrc.json`)).toBeTruthy();
        expect(tree.exists(`my-dir/my-lib/package.json`)).toBeTruthy();
      });

      it('should update project configuration', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          directory: 'my-dir/my-lib',
          config: 'workspace',
          projectNameAndRootFormat: 'as-provided',
        });

        expect(readProjectConfiguration(tree, 'my-lib').root).toEqual(
          'my-dir/my-lib'
        );
      });

      it('should update root tsconfig.base.json', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          directory: 'my-dir/my-lib',
          projectNameAndRootFormat: 'as-provided',
        });
        const tsconfigJson = readJson(tree, '/tsconfig.base.json');
        expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
          'my-dir/my-lib/src/index.ts',
        ]);
        expect(tsconfigJson.compilerOptions.paths['my-lib/*']).toBeUndefined();
      });

      it('should update root tsconfig.json when no tsconfig.base.json', async () => {
        tree.rename('tsconfig.base.json', 'tsconfig.json');

        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          directory: 'my-dir/my-lib',
          projectNameAndRootFormat: 'as-provided',
        });

        const tsconfigJson = readJson(tree, '/tsconfig.json');
        expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
          'my-dir/my-lib/src/index.ts',
        ]);
        expect(tsconfigJson.compilerOptions.paths['my-lib/*']).toBeUndefined();
      });

      it('should create a local tsconfig.json', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          directory: 'my-dir/my-lib',
          projectNameAndRootFormat: 'as-provided',
        });

        const tsconfigJson = readJson(tree, 'my-dir/my-lib/tsconfig.json');
        expect(tsconfigJson.references).toEqual([
          {
            path: './tsconfig.lib.json',
          },
          {
            path: './tsconfig.spec.json',
          },
        ]);
      });

      it('should extend from root tsconfig.base.json', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          directory: 'my-dir/my-lib',
          projectNameAndRootFormat: 'as-provided',
        });

        const tsconfigJson = readJson(tree, 'my-dir/my-lib/tsconfig.json');
        expect(tsconfigJson.extends).toBe('../../tsconfig.base.json');
      });

      it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
        tree.rename('tsconfig.base.json', 'tsconfig.json');

        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          directory: 'my-dir/my-lib',
          projectNameAndRootFormat: 'as-provided',
        });

        const tsconfigJson = readJson(tree, 'my-dir/my-lib/tsconfig.json');
        expect(tsconfigJson.extends).toBe('../../tsconfig.json');
      });
    });

    describe('--no-strict', () => {
      it('should update the projects tsconfig with strict false', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          strict: false,
          projectNameAndRootFormat: 'as-provided',
        });
        const tsconfigJson = readJson(tree, '/my-lib/tsconfig.json');

        expect(
          tsconfigJson.compilerOptions?.forceConsistentCasingInFileNames
        ).not.toBeDefined();
        expect(tsconfigJson.compilerOptions?.strict).not.toBeDefined();
        expect(
          tsconfigJson.compilerOptions?.noImplicitOverride
        ).not.toBeDefined();
        expect(
          tsconfigJson.compilerOptions?.noPropertyAccessFromIndexSignature
        ).not.toBeDefined();
        expect(
          tsconfigJson.compilerOptions?.noImplicitReturns
        ).not.toBeDefined();
        expect(
          tsconfigJson.compilerOptions?.noFallthroughCasesInSwitch
        ).not.toBeDefined();
      });

      it('should default to strict true', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          projectNameAndRootFormat: 'as-provided',
        });
        const tsconfigJson = readJson(tree, '/my-lib/tsconfig.json');

        expect(tsconfigJson.compilerOptions.strict).toBeTruthy();
        expect(
          tsconfigJson.compilerOptions.forceConsistentCasingInFileNames
        ).toBeTruthy();
        expect(tsconfigJson.compilerOptions.noImplicitReturns).toBeTruthy();
        expect(
          tsconfigJson.compilerOptions.noFallthroughCasesInSwitch
        ).toBeTruthy();
      });
    });

    describe('--importPath', () => {
      it('should update the tsconfig with the given import path', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          directory: 'my-dir/my-lib',
          importPath: '@myorg/lib',
          projectNameAndRootFormat: 'as-provided',
        });
        const tsconfigJson = readJson(tree, '/tsconfig.base.json');

        expect(tsconfigJson.compilerOptions.paths['@myorg/lib']).toBeDefined();
      });

      it('should fail if the same importPath has already been used', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib1',
          importPath: '@myorg/lib',
          projectNameAndRootFormat: 'as-provided',
        });

        try {
          await libraryGenerator(tree, {
            ...defaultOptions,
            name: 'myLib2',
            importPath: '@myorg/lib',
            projectNameAndRootFormat: 'as-provided',
          });
        } catch (e) {
          expect(e.message).toContain(
            'You already have a library using the import path'
          );
        }

        expect.assertions(1);
      });

      it('should provide a default import path using npm scope', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          projectNameAndRootFormat: 'as-provided',
        });

        const tsconfigJson = readJson(tree, '/tsconfig.base.json');
        expect(
          tsconfigJson.compilerOptions.paths['@proj/my-lib']
        ).toBeDefined();
      });

      it('should read import path from existing name in package.json', async () => {
        updateJson(tree, 'package.json', (json) => {
          json.name = '@acme/core';
          return json;
        });
        await libraryGenerator(tree, {
          ...defaultOptions,
          rootProject: true,
          name: 'my-lib',
          projectNameAndRootFormat: 'as-provided',
        });

        const tsconfigJson = readJson(tree, '/tsconfig.base.json');
        expect(tsconfigJson.compilerOptions.paths['@acme/core']).toBeDefined();
      });
    });

    describe('--pascalCaseFiles', () => {
      it('should generate files with upper case names', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          pascalCaseFiles: true,
          projectNameAndRootFormat: 'as-provided',
        });
        expect(tree.exists('my-lib/src/lib/MyLib.ts')).toBeTruthy();
        expect(tree.exists('my-lib/src/lib/MyLib.spec.ts')).toBeTruthy();
      });

      it('should generate files with upper case names for nested libs as well', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          directory: 'my-dir/my-lib',
          pascalCaseFiles: true,
          projectNameAndRootFormat: 'as-provided',
        });
        expect(tree.exists('my-dir/my-lib/src/lib/MyLib.ts')).toBeTruthy();
        expect(tree.exists('my-dir/my-lib/src/lib/MyLib.spec.ts')).toBeTruthy();
      });
    });
  });

  describe('--linter', () => {
    it('should add eslint dependencies', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'my-lib',
        projectNameAndRootFormat: 'as-provided',
      });

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies['eslint']).toBeDefined();
      expect(packageJson.devDependencies['@nx/eslint']).toBeDefined();
      expect(packageJson.devDependencies['@nx/eslint-plugin']).toBeDefined();
    });

    describe('not nested', () => {
      it('should create a local .eslintrc.json', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          projectNameAndRootFormat: 'as-provided',
        });

        const eslintJson = readJson(tree, 'my-lib/.eslintrc.json');
        expect(eslintJson).toMatchInlineSnapshot(`
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
              {
                "files": [
                  "*.json",
                ],
                "parser": "jsonc-eslint-parser",
                "rules": {
                  "@nx/dependency-checks": "error",
                },
              },
            ],
          }
        `);
      });
    });

    describe('nested', () => {
      it('should create a local .eslintrc.json', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          directory: 'my-dir/my-lib',
          projectNameAndRootFormat: 'as-provided',
        });

        const eslintJson = readJson(tree, 'my-dir/my-lib/.eslintrc.json');
        expect(eslintJson).toMatchInlineSnapshot(`
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
              {
                "files": [
                  "*.json",
                ],
                "parser": "jsonc-eslint-parser",
                "rules": {
                  "@nx/dependency-checks": "error",
                },
              },
            ],
          }
        `);
      });
    });

    describe('--js flag', () => {
      it('should generate js files instead of ts files', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          js: true,
          projectNameAndRootFormat: 'as-provided',
        });
        expect(tree.exists(`my-lib/jest.config.js`)).toBeTruthy();
        expect(tree.exists('my-lib/src/index.js')).toBeTruthy();
        expect(tree.exists('my-lib/src/lib/my-lib.js')).toBeTruthy();
        expect(tree.exists('my-lib/src/lib/my-lib.spec.js')).toBeTruthy();
      });

      it('should update tsconfig.json with compilerOptions.allowJs: true', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          js: true,
          projectNameAndRootFormat: 'as-provided',
        });
        expect(
          readJson(tree, 'my-lib/tsconfig.json').compilerOptions.allowJs
        ).toBeTruthy();
      });

      it('should update tsconfig.lib.json include with src/**/*.js glob', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          js: true,
          projectNameAndRootFormat: 'as-provided',
        });
        expect(readJson(tree, 'my-lib/tsconfig.lib.json').include).toEqual([
          'src/**/*.ts',
          'src/**/*.js',
        ]);
      });

      it('should update root tsconfig.json with a js file path', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          js: true,
          projectNameAndRootFormat: 'as-provided',
        });
        const tsconfigJson = readJson(tree, '/tsconfig.base.json');
        expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
          'my-lib/src/index.js',
        ]);
      });

      it('should generate js files for nested libs as well', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          directory: 'my-dir/my-lib',
          js: true,
          projectNameAndRootFormat: 'as-provided',
        });
        expect(tree.exists(`my-dir/my-lib/jest.config.js`)).toBeTruthy();
        expect(tree.exists('my-dir/my-lib/src/index.js')).toBeTruthy();
        expect(tree.exists('my-dir/my-lib/src/lib/my-lib.js')).toBeTruthy();
        expect(
          tree.exists('my-dir/my-lib/src/lib/my-lib.spec.js')
        ).toBeTruthy();
        expect(tree.exists('my-dir/my-lib/src/index.js')).toBeTruthy();
      });

      it('should configure the project for linting js files', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          directory: 'my-dir/my-lib',
          js: true,
          projectNameAndRootFormat: 'as-provided',
        });
        expect(readJson(tree, 'my-dir/my-lib/.eslintrc.json'))
          .toMatchInlineSnapshot(`
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
              {
                "files": [
                  "*.json",
                ],
                "parser": "jsonc-eslint-parser",
                "rules": {
                  "@nx/dependency-checks": "error",
                },
              },
            ],
          }
        `);
      });
    });
  });

  describe('--unit-test-runner jest', () => {
    it('should generate test configuration', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'my-lib',
        unitTestRunner: 'jest',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(tree.exists('my-lib/tsconfig.spec.json')).toBeTruthy();
      expect(tree.exists('my-lib/jest.config.ts')).toBeTruthy();
      expect(tree.exists('my-lib/src/lib/my-lib.spec.ts')).toBeTruthy();

      expect(tree.exists(`my-lib/jest.config.ts`)).toBeTruthy();
      expect(tree.read(`my-lib/jest.config.ts`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "/* eslint-disable */
        export default {
          displayName: 'my-lib',
          preset: '../jest.preset.js',
          transform: {
            '^.+\\\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
          },
          moduleFileExtensions: ['ts', 'js', 'html'],
          coverageDirectory: '../coverage/my-lib',
        };
        "
      `);
      const readme = tree.read('my-lib/README.md', 'utf-8');
      expect(readme).toContain('nx test my-lib');
    });

    it('should generate test configuration with swc and js', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'my-lib',
        unitTestRunner: 'jest',
        bundler: 'swc',
        js: true,
        projectNameAndRootFormat: 'as-provided',
      });

      expect(tree.exists('my-lib/tsconfig.spec.json')).toBeTruthy();
      expect(tree.exists('my-lib/jest.config.js')).toBeTruthy();
      expect(tree.exists('my-lib/src/lib/my-lib.spec.js')).toBeTruthy();

      expect(tree.exists(`my-lib/jest.config.js`)).toBeTruthy();
      expect(tree.read(`my-lib/jest.config.js`, 'utf-8')).toMatchSnapshot();
      const readme = tree.read('my-lib/README.md', 'utf-8');
      expect(readme).toContain('nx test my-lib');
    });

    describe('--buildable deprecation - replace with other options', () => {
      it('should NOT generate the build target if bundler is none', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          bundler: 'none',
          projectNameAndRootFormat: 'as-provided',
        });

        const config = readProjectConfiguration(tree, 'my-lib');
        expect(config.targets.build).not.toBeDefined();
      });

      it('should still generate the build target if bundler is undefined', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          projectNameAndRootFormat: 'as-provided',
        });

        const config = readProjectConfiguration(tree, 'my-lib');
        expect(config.targets.build).toBeDefined();
      });

      it('should generate the build target', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          bundler: 'tsc',
          projectNameAndRootFormat: 'as-provided',
        });

        const config = readProjectConfiguration(tree, 'my-lib');
        expect(config.targets.build).toEqual({
          executor: '@nx/js:tsc',
          options: {
            assets: ['my-lib/*.md'],
            main: 'my-lib/src/index.ts',
            outputPath: 'dist/my-lib',
            tsConfig: 'my-lib/tsconfig.lib.json',
          },
          outputs: ['{options.outputPath}'],
        });
      });

      it('should generate the build target for swc', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          bundler: 'swc',
          projectNameAndRootFormat: 'as-provided',
        });

        const config = readProjectConfiguration(tree, 'my-lib');
        expect(config.targets.build).toEqual({
          executor: '@nx/js:swc',
          options: {
            assets: ['my-lib/*.md'],
            main: 'my-lib/src/index.ts',
            outputPath: 'dist/my-lib',
            tsConfig: 'my-lib/tsconfig.lib.json',
          },
          outputs: ['{options.outputPath}'],
        });
      });

      it('should generate swcrc for swc', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          bundler: 'swc',
          projectNameAndRootFormat: 'as-provided',
        });

        expect(tree.exists('my-lib/.swcrc')).toBeTruthy();
      });

      it('should setup jest project using swc', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          bundler: 'swc',
          projectNameAndRootFormat: 'as-provided',
        });

        const jestConfig = tree.read('my-lib/jest.config.ts').toString();
        expect(jestConfig).toContain('@swc/jest');
      });

      it('should generate a package.json file', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          bundler: 'tsc',
          projectNameAndRootFormat: 'as-provided',
        });

        expect(tree.exists('my-lib/package.json')).toBeTruthy();
      });
    });

    describe('--buildable -- make sure old schema still works - no breaking change', () => {
      it('should generate the build target', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          buildable: true,
          compiler: 'tsc',
          projectNameAndRootFormat: 'as-provided',
        });

        const config = readProjectConfiguration(tree, 'my-lib');
        expect(config.targets.build).toEqual({
          executor: '@nx/js:tsc',
          options: {
            assets: ['my-lib/*.md'],
            main: 'my-lib/src/index.ts',
            outputPath: 'dist/my-lib',
            tsConfig: 'my-lib/tsconfig.lib.json',
          },
          outputs: ['{options.outputPath}'],
        });
      });

      it('should generate the build target for swc', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          buildable: true,
          compiler: 'swc',
          projectNameAndRootFormat: 'as-provided',
        });

        const config = readProjectConfiguration(tree, 'my-lib');
        expect(config.targets.build).toEqual({
          executor: '@nx/js:swc',
          options: {
            assets: ['my-lib/*.md'],
            main: 'my-lib/src/index.ts',
            outputPath: 'dist/my-lib',
            tsConfig: 'my-lib/tsconfig.lib.json',
          },
          outputs: ['{options.outputPath}'],
        });
      });

      it('should generate swcrc for swc', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          buildable: true,
          compiler: 'swc',
          projectNameAndRootFormat: 'as-provided',
        });

        expect(tree.exists('my-lib/.swcrc')).toBeTruthy();
      });

      it('should setup jest project using swc', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          buildable: true,
          compiler: 'swc',
          projectNameAndRootFormat: 'as-provided',
        });

        const jestConfig = tree.read('my-lib/jest.config.ts').toString();
        expect(jestConfig).toContain('@swc/jest');
      });

      it('should generate a package.json file', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          buildable: true,
          compiler: 'tsc',
          projectNameAndRootFormat: 'as-provided',
        });

        expect(tree.exists('my-lib/package.json')).toBeTruthy();
      });
    });

    describe('bundler=rollup - no compiler', () => {
      it('should generate correct options for build', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          bundler: 'rollup',
          projectNameAndRootFormat: 'as-provided',
        });

        const pkgJson = readJson(tree, 'my-lib/package.json');
        expect(pkgJson.type).not.toBeDefined();
      });

      it('should always set compiler to swc if bundler is rollup', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          bundler: 'rollup',
          projectNameAndRootFormat: 'as-provided',
        });
      });
    });

    describe('--publishable', () => {
      it('should generate the build target', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          publishable: true,
          importPath: '@proj/my-lib',
          bundler: 'tsc',
          projectNameAndRootFormat: 'as-provided',
        });

        const config = readProjectConfiguration(tree, 'my-lib');
        expect(config.targets.build).toEqual({
          executor: '@nx/js:tsc',
          options: {
            assets: ['my-lib/*.md'],
            main: 'my-lib/src/index.ts',
            outputPath: 'dist/my-lib',
            tsConfig: 'my-lib/tsconfig.lib.json',
          },
          outputs: ['{options.outputPath}'],
        });
      });

      it('should update the nx-release-publish target to specify dist/{projectRoot} as the package root', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          publishable: true,
          importPath: '@proj/my-lib',
          bundler: 'tsc',
          projectNameAndRootFormat: 'as-provided',
        });

        const config = readProjectConfiguration(tree, 'my-lib');
        expect(config.targets['nx-release-publish']).toEqual({
          options: {
            packageRoot: 'dist/{projectRoot}',
          },
        });
      });

      describe('nx release config', () => {
        it('should not change preVersionCommand if it already exists', async () => {
          updateJson(tree, 'nx.json', (json) => {
            json.release = {
              version: {
                preVersionCommand: 'echo "hello world"',
              },
            };
            return json;
          });

          await libraryGenerator(tree, {
            ...defaultOptions,
            name: 'my-lib',
            publishable: true,
            importPath: '@proj/my-lib',
            bundler: 'tsc',
            projectNameAndRootFormat: 'as-provided',
          });

          const nxJson = readJson(tree, 'nx.json');
          expect(nxJson.release).toEqual({
            version: {
              preVersionCommand: 'echo "hello world"',
            },
          });
        });

        it('should not add projects if no release config exists', async () => {
          updateJson(tree, 'nx.json', (json) => {
            delete json.release;
            return json;
          });

          await libraryGenerator(tree, {
            ...defaultOptions,
            name: 'my-lib',
            publishable: true,
            importPath: '@proj/my-lib',
            bundler: 'tsc',
            projectNameAndRootFormat: 'as-provided',
          });

          const nxJson = readJson(tree, 'nx.json');
          expect(nxJson.release).toEqual({
            version: {
              preVersionCommand: `${
                getPackageManagerCommand().dlx
              } nx run-many -t build`,
            },
          });
        });

        it("should not add projects if release config exists but doesn't specify groups or projects", async () => {
          const existingReleaseConfig = {
            version: {
              git: {},
            },
            changelog: {
              projectChangelogs: true,
            },
          };
          updateJson(tree, 'nx.json', (json) => {
            json.release = existingReleaseConfig;
            return json;
          });

          await libraryGenerator(tree, {
            ...defaultOptions,
            name: 'my-lib',
            publishable: true,
            importPath: '@proj/my-lib',
            bundler: 'tsc',
            projectNameAndRootFormat: 'as-provided',
          });

          const nxJson = readJson(tree, 'nx.json');
          expect(nxJson.release).toEqual({
            ...existingReleaseConfig,
            version: {
              ...existingReleaseConfig.version,
              preVersionCommand: `${
                getPackageManagerCommand().dlx
              } nx run-many -t build`,
            },
          });
        });

        it('should not change projects if it already exists as a string and matches the new project', async () => {
          updateJson(tree, 'nx.json', (json) => {
            json.release = {
              projects: '*',
            };
            return json;
          });

          await libraryGenerator(tree, {
            ...defaultOptions,
            name: 'my-lib',
            publishable: true,
            importPath: '@proj/my-lib',
            bundler: 'tsc',
            projectNameAndRootFormat: 'as-provided',
          });

          const nxJson = readJson(tree, 'nx.json');
          expect(nxJson.release).toEqual({
            projects: '*',
            version: {
              preVersionCommand: `${
                getPackageManagerCommand().dlx
              } nx run-many -t build`,
            },
          });
        });

        it('should not change projects if it already exists as an array and matches the new project by name', async () => {
          updateJson(tree, 'nx.json', (json) => {
            json.release = {
              projects: ['something-else', 'my-lib'],
            };
            return json;
          });

          await libraryGenerator(tree, {
            ...defaultOptions,
            name: 'my-lib',
            publishable: true,
            importPath: '@proj/my-lib',
            bundler: 'tsc',
            projectNameAndRootFormat: 'as-provided',
          });

          const nxJson = readJson(tree, 'nx.json');
          expect(nxJson.release).toEqual({
            projects: ['something-else', 'my-lib'],
            version: {
              preVersionCommand: `${
                getPackageManagerCommand().dlx
              } nx run-many -t build`,
            },
          });
        });

        it('should not change projects if it already exists and matches the new project by tag', async () => {
          updateJson(tree, 'nx.json', (json) => {
            json.release = {
              projects: ['tag:one'],
            };
            return json;
          });

          await libraryGenerator(tree, {
            ...defaultOptions,
            name: 'my-lib',
            publishable: true,
            importPath: '@proj/my-lib',
            bundler: 'tsc',
            projectNameAndRootFormat: 'as-provided',
            tags: 'one,two',
          });

          const nxJson = readJson(tree, 'nx.json');
          expect(nxJson.release).toEqual({
            projects: ['tag:one'],
            version: {
              preVersionCommand: `${
                getPackageManagerCommand().dlx
              } nx run-many -t build`,
            },
          });
        });

        it('should not change projects if it already exists and matches the new project by root directory', async () => {
          updateJson(tree, 'nx.json', (json) => {
            json.release = {
              projects: ['packages/*'],
            };
            return json;
          });

          await libraryGenerator(tree, {
            ...defaultOptions,
            name: 'my-lib',
            publishable: true,
            importPath: '@proj/my-lib',
            bundler: 'tsc',
            projectNameAndRootFormat: 'as-provided',
            directory: 'packages/my-lib',
          });

          const nxJson = readJson(tree, 'nx.json');
          expect(nxJson.release).toEqual({
            projects: ['packages/*'],
            version: {
              preVersionCommand: `${
                getPackageManagerCommand().dlx
              } nx run-many -t build`,
            },
          });
        });

        it("should append project to projects if projects exists as an array, but doesn't already match the new project", async () => {
          updateJson(tree, 'nx.json', (json) => {
            json.release = {
              projects: ['something-else'],
            };
            return json;
          });

          await libraryGenerator(tree, {
            ...defaultOptions,
            name: 'my-lib',
            publishable: true,
            importPath: '@proj/my-lib',
            bundler: 'tsc',
            projectNameAndRootFormat: 'as-provided',
          });

          const nxJson = readJson(tree, 'nx.json');
          expect(nxJson.release).toEqual({
            projects: ['something-else', 'my-lib'],
            version: {
              preVersionCommand: `${
                getPackageManagerCommand().dlx
              } nx run-many -t build`,
            },
          });
        });

        it("should convert projects to an array and append the new project to it if projects exists as a string, but doesn't already match the new project", async () => {
          updateJson(tree, 'nx.json', (json) => {
            json.release = {
              projects: 'packages',
            };
            return json;
          });

          await libraryGenerator(tree, {
            ...defaultOptions,
            name: 'my-lib',
            publishable: true,
            importPath: '@proj/my-lib',
            bundler: 'tsc',
            projectNameAndRootFormat: 'as-provided',
          });

          const nxJson = readJson(tree, 'nx.json');
          expect(nxJson.release).toEqual({
            projects: ['packages', 'my-lib'],
            version: {
              preVersionCommand: `${
                getPackageManagerCommand().dlx
              } nx run-many -t build`,
            },
          });
        });

        it('should not change projects if it already exists as groups config and matches the new project', async () => {
          const existingReleaseConfig = {
            groups: {
              group1: {
                projects: ['something-else'],
              },
              group2: {
                projects: ['my-lib'],
              },
            },
          };
          updateJson(tree, 'nx.json', (json) => {
            json.release = existingReleaseConfig;
            return json;
          });

          await libraryGenerator(tree, {
            ...defaultOptions,
            name: 'my-lib',
            publishable: true,
            importPath: '@proj/my-lib',
            bundler: 'tsc',
            projectNameAndRootFormat: 'as-provided',
          });

          const nxJson = readJson(tree, 'nx.json');
          expect(nxJson.release).toEqual({
            groups: existingReleaseConfig.groups,
            version: {
              preVersionCommand: `${
                getPackageManagerCommand().dlx
              } nx run-many -t build`,
            },
          });
        });

        it("should warn the user if their defined groups don't match the new project", async () => {
          const outputSpy = jest
            .spyOn(output, 'warn')
            .mockImplementationOnce(() => {
              return undefined as never;
            });

          const existingReleaseConfig = {
            groups: {
              group1: {
                projects: ['something-else'],
              },
              group2: {
                projects: ['other-thing'],
              },
            },
          };
          updateJson(tree, 'nx.json', (json) => {
            json.release = existingReleaseConfig;
            return json;
          });

          await libraryGenerator(tree, {
            ...defaultOptions,
            name: 'my-lib',
            publishable: true,
            importPath: '@proj/my-lib',
            bundler: 'tsc',
            projectNameAndRootFormat: 'as-provided',
          });

          const nxJson = readJson(tree, 'nx.json');
          expect(nxJson.release).toEqual({
            groups: existingReleaseConfig.groups,
            version: {
              preVersionCommand: `${
                getPackageManagerCommand().dlx
              } nx run-many -t build`,
            },
          });
          expect(outputSpy).toHaveBeenCalledWith({
            title: `Could not find a release group that includes my-lib`,
            bodyLines: [
              `Ensure that my-lib is included in a release group's "projects" list in nx.json so it can be published with "nx release"`,
            ],
          });

          outputSpy.mockRestore();
        });
      });
    });

    describe('--includeBabelRc', () => {
      it('should generate a .babelrc when flag is set to true', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          includeBabelRc: true,
          projectNameAndRootFormat: 'as-provided',
        });

        expect(tree.exists('my-lib/.babelrc')).toBeTruthy();
      });

      it('should not generate a .babelrc when flag is set to false', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          includeBabelRc: false,
          projectNameAndRootFormat: 'as-provided',
        });

        expect(tree.exists('my-lib/.babelrc')).toBeFalsy();
      });

      it('should not generate a .babelrc when bundler is swc (even if flag is set to true)', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          bundler: 'swc',
          includeBabelRc: true,
          projectNameAndRootFormat: 'as-provided',
        });

        expect(tree.exists('my-lib/.babelrc')).toBeFalsy();
      });

      it('should generate a .babelrc when flag is set to true (even if there is no `@nx/web` plugin installed)', async () => {
        updateJson(tree, 'package.json', (json) => {
          json.devDependencies = {};
          return json;
        });

        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          includeBabelRc: true,
          projectNameAndRootFormat: 'as-provided',
        });

        expect(tree.exists('my-lib/.babelrc')).toBeTruthy();

        const babelRc = readJson(tree, 'my-lib/.babelrc');
        expect(babelRc).toMatchInlineSnapshot(`
          {
            "presets": [
              [
                "@nx/js/babel",
                {
                  "useBuiltIns": "usage",
                },
              ],
            ],
          }
        `);
      });

      it('should not generate a .babelrc when flag is not set and there is NOT a `@nx/web` package installed', async () => {
        updateJson(tree, 'package.json', (json) => {
          json.devDependencies = {
            '@nx/angular': '1.1.1',
            '@nx/next': '1.1.1',
          };
          return json;
        });

        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          includeBabelRc: undefined,
          projectNameAndRootFormat: 'as-provided',
        });

        expect(tree.exists('my-lib/.babelrc')).toBeFalsy();
      });
    });
  });

  describe('--bundler=esbuild', () => {
    it('should add build with esbuild', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'my-lib',
        bundler: 'esbuild',
        unitTestRunner: 'none',
        projectNameAndRootFormat: 'as-provided',
      });

      const project = readProjectConfiguration(tree, 'my-lib');
      expect(project.targets.build).toMatchObject({
        executor: '@nx/esbuild:esbuild',
      });
      expect(readJson(tree, 'my-lib/.eslintrc.json').overrides).toContainEqual({
        files: ['*.json'],
        parser: 'jsonc-eslint-parser',
        rules: {
          '@nx/dependency-checks': [
            'error',
            {
              ignoredFiles: ['{projectRoot}/esbuild.config.{js,ts,mjs,mts}'],
            },
          ],
        },
      });
    });
  });

  describe('--bundler=rollup', () => {
    it('should add build with rollup', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'my-lib',
        bundler: 'rollup',
        unitTestRunner: 'none',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(readJson(tree, 'my-lib/.eslintrc.json').overrides).toContainEqual({
        files: ['*.json'],
        parser: 'jsonc-eslint-parser',
        rules: {
          '@nx/dependency-checks': [
            'error',
            {
              ignoredFiles: ['{projectRoot}/rollup.config.{js,ts,mjs,mts}'],
            },
          ],
        },
      });
    });
  });

  describe('--minimal', () => {
    it('should generate a README.md when minimal is set to false', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'my-lib',
        minimal: false,
        projectNameAndRootFormat: 'as-provided',
      });

      expect(tree.exists('my-lib/README.md')).toBeTruthy();
    });

    it('should not generate a README.md when minimal is set to true', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'my-lib',
        minimal: true,
        projectNameAndRootFormat: 'as-provided',
      });

      expect(tree.exists('my-lib/README.md')).toBeFalsy();
    });

    it('should generate a README.md and add it to the build assets when buildable is true and minimal is false', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'my-lib',
        bundler: 'tsc',
        minimal: false,
        projectNameAndRootFormat: 'as-provided',
      });

      expect(tree.exists('my-lib/README.md')).toBeTruthy();

      const project = readProjectConfiguration(tree, 'my-lib');
      expect(project.targets.build.options.assets).toStrictEqual([
        'my-lib/*.md',
      ]);
    });

    it('should not generate a README.md when both bundler and minimal are set', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'my-lib',
        bundler: 'tsc',
        minimal: true,
        projectNameAndRootFormat: 'as-provided',
      });

      expect(tree.exists('my-lib/README.md')).toBeFalsy();

      const project = readProjectConfiguration(tree, 'my-lib');
      expect(project.targets.build.options.assets).toEqual([]);
    });
  });

  describe('--simpleName', () => {
    it('should generate a simple name', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'my-lib',
        simpleName: true,
        directory: 'web/my-lib',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(tree.read('web/my-lib/src/index.ts', 'utf-8')).toContain(
        `export * from './lib/my-lib';`
      );
      expect(tree.exists('web/my-lib/src/lib/my-lib.ts')).toBeTruthy();
    });
  });

  describe('--testEnvironment', () => {
    it('should generate a vite config with testEnvironment set to node', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'my-node-lib',
        unitTestRunner: 'vitest',
        testEnvironment: 'node',
      });

      const content = tree.read('my-node-lib/vite.config.ts', 'utf-8');

      expect(content).toContain(`environment: 'node'`);
    });

    it('should generate a vite config with testEnvironment set to jsdom by default', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'my-jsdom-lib',
        unitTestRunner: 'vitest',
        testEnvironment: undefined,
      });

      const content = tree.read('my-jsdom-lib/vite.config.ts', 'utf-8');

      expect(content).toContain(`environment: 'jsdom'`);
    });
  });
});
