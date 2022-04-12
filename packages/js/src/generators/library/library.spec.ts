import {
  getProjects,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { LibraryGeneratorSchema } from '../../utils/schema';
import libraryGenerator from './library';

describe('lib', () => {
  let tree: Tree;
  const defaultOptions: Omit<LibraryGeneratorSchema, 'name'> = {
    skipTsConfig: false,
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
    tree = createTreeWithEmptyWorkspace(2);
  });

  describe('configs', () => {
    it('should generate an empty ts lib using --config=npm-scripts', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'myLib',
        config: 'npm-scripts',
      });
      expect(readJson(tree, '/libs/my-lib/package.json')).toEqual({
        name: '@proj/my-lib',
        version: '0.0.1',
        type: 'commonjs',
        scripts: {
          build: "echo 'implement build'",
          test: "echo 'implement test'",
        },
      });

      expect(tree.exists('libs/my-lib/src/index.ts')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.ts')).toBeTruthy();

      // unitTestRunner property is ignored.
      // It only works with our executors.
      expect(tree.exists('libs/my-lib/src/lib/my-lib.spec.ts')).toBeFalsy();
      const workspaceJson = readJson(tree, '/workspace.json');
      // Blocked on Craigory merging optional config PR
      // expect(workspaceJson.projects['my-lib']).toBeUndefined();
      // expect(tree.exists('libs/my-lib/project.json')).toBeFalsy();
    });

    it('should generate an empty ts lib using --config=project', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'my-lib',
        config: 'project',
      });
      const workspaceJsonEntry = readJson(tree, 'workspace.json').projects[
        'my-lib'
      ];
      const projectConfig = readProjectConfiguration(tree, 'my-lib');
      expect(projectConfig.root).toEqual('libs/my-lib');
      expect(workspaceJsonEntry).toEqual('libs/my-lib');
    });

    it('should generate an empty ts lib using --config=workspace', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'my-lib',
        config: 'workspace',
      });
      const workspaceJsonEntry = readJson(tree, 'workspace.json').projects[
        'my-lib'
      ];
      const projectConfig = readProjectConfiguration(tree, 'my-lib');
      expect(projectConfig.root).toEqual('libs/my-lib');
      expect(projectConfig).toMatchObject(workspaceJsonEntry);
    });
  });

  describe('shared options', () => {
    describe('not-nested', () => {
      it('should update tags', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
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
        await libraryGenerator(tree, { ...defaultOptions, name: 'myLib' });
        const tsconfigJson = readJson(tree, '/tsconfig.base.json');
        expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
          'libs/my-lib/src/index.ts',
        ]);
      });

      it('should update root tsconfig.json when no tsconfig.base.json', async () => {
        tree.rename('tsconfig.base.json', 'tsconfig.json');

        await libraryGenerator(tree, { ...defaultOptions, name: 'myLib' });

        const tsconfigJson = readJson(tree, 'tsconfig.json');
        expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
          'libs/my-lib/src/index.ts',
        ]);
      });

      it('should update root tsconfig.base.json (no existing path mappings)', async () => {
        updateJson(tree, 'tsconfig.base.json', (json) => {
          json.compilerOptions.paths = undefined;
          return json;
        });

        await libraryGenerator(tree, { ...defaultOptions, name: 'myLib' });
        const tsconfigJson = readJson(tree, '/tsconfig.base.json');
        expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
          'libs/my-lib/src/index.ts',
        ]);
      });

      it('should create a local tsconfig.json', async () => {
        await libraryGenerator(tree, { ...defaultOptions, name: 'myLib' });
        const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.json');
        expect(tsconfigJson).toMatchInlineSnapshot(`
                  Object {
                    "compilerOptions": Object {
                      "forceConsistentCasingInFileNames": true,
                      "module": "commonjs",
                      "noFallthroughCasesInSwitch": true,
                      "noImplicitOverride": true,
                      "noImplicitReturns": true,
                      "noPropertyAccessFromIndexSignature": true,
                      "strict": true,
                    },
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

      it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
        tree.rename('tsconfig.base.json', 'tsconfig.json');

        await libraryGenerator(tree, { ...defaultOptions, name: 'myLib' });

        const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.json');
        expect(tsconfigJson.extends).toBe('../../tsconfig.json');
      });
    });

    describe('nested', () => {
      it('should update tags', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
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
          ...defaultOptions,
          name: 'myLib2',
          directory: 'myDir',
          tags: 'one,two',
          simpleModuleName: true,
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
          ...defaultOptions,
          name: 'myLib',
          directory: 'myDir',
        });
        expect(tree.exists(`libs/my-dir/my-lib/jest.config.js`)).toBeTruthy();
        expect(tree.exists('libs/my-dir/my-lib/src/index.ts')).toBeTruthy();
        expect(
          tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.ts')
        ).toBeTruthy();
        expect(
          tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.spec.ts')
        ).toBeTruthy();
        expect(tree.exists('libs/my-dir/my-lib/src/index.ts')).toBeTruthy();
        expect(tree.exists(`libs/my-dir/my-lib/.eslintrc.json`)).toBeTruthy();
        expect(tree.exists(`libs/my-dir/my-lib/package.json`)).toBeFalsy();
      });

      it('should update workspace.json', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          directory: 'myDir',
          config: 'workspace',
        });
        const workspaceJson = readJson(tree, '/workspace.json');

        expect(workspaceJson.projects['my-dir-my-lib'].root).toEqual(
          'libs/my-dir/my-lib'
        );
      });

      it('should update root tsconfig.base.json', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          directory: 'myDir',
        });
        const tsconfigJson = readJson(tree, '/tsconfig.base.json');
        expect(
          tsconfigJson.compilerOptions.paths['@proj/my-dir/my-lib']
        ).toEqual(['libs/my-dir/my-lib/src/index.ts']);
        expect(
          tsconfigJson.compilerOptions.paths['my-dir-my-lib/*']
        ).toBeUndefined();
      });

      it('should update root tsconfig.json when no tsconfig.base.json', async () => {
        tree.rename('tsconfig.base.json', 'tsconfig.json');

        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          directory: 'myDir',
        });

        const tsconfigJson = readJson(tree, '/tsconfig.json');
        expect(
          tsconfigJson.compilerOptions.paths['@proj/my-dir/my-lib']
        ).toEqual(['libs/my-dir/my-lib/src/index.ts']);
        expect(
          tsconfigJson.compilerOptions.paths['my-dir-my-lib/*']
        ).toBeUndefined();
      });

      it('should create a local tsconfig.json', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          directory: 'myDir',
        });

        const tsconfigJson = readJson(tree, 'libs/my-dir/my-lib/tsconfig.json');
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
          name: 'myLib',
          directory: 'myDir',
        });

        const tsconfigJson = readJson(tree, 'libs/my-dir/my-lib/tsconfig.json');
        expect(tsconfigJson.extends).toBe('../../../tsconfig.base.json');
      });

      it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
        tree.rename('tsconfig.base.json', 'tsconfig.json');

        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          directory: 'myDir',
        });

        const tsconfigJson = readJson(tree, 'libs/my-dir/my-lib/tsconfig.json');
        expect(tsconfigJson.extends).toBe('../../../tsconfig.json');
      });
    });

    describe('--no-strict', () => {
      it('should update the projects tsconfig with strict false', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          strict: false,
        });
        const tsconfigJson = readJson(tree, '/libs/my-lib/tsconfig.json');

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
          name: 'myLib',
        });
        const tsconfigJson = readJson(tree, '/libs/my-lib/tsconfig.json');

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
          name: 'myLib',
          directory: 'myDir',
          importPath: '@myorg/lib',
        });
        const tsconfigJson = readJson(tree, '/tsconfig.base.json');

        expect(tsconfigJson.compilerOptions.paths['@myorg/lib']).toBeDefined();
      });

      it('should fail if the same importPath has already been used', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib1',
          importPath: '@myorg/lib',
        });

        try {
          await libraryGenerator(tree, {
            ...defaultOptions,
            name: 'myLib2',
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

    describe('--pascalCaseFiles', () => {
      it('should generate files with upper case names', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          pascalCaseFiles: true,
        });
        expect(tree.exists('libs/my-lib/src/lib/MyLib.ts')).toBeTruthy();
        expect(tree.exists('libs/my-lib/src/lib/MyLib.spec.ts')).toBeTruthy();
      });

      it('should generate files with upper case names for nested libs as well', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          directory: 'myDir',
          pascalCaseFiles: true,
        });
        expect(
          tree.exists('libs/my-dir/my-lib/src/lib/MyDirMyLib.ts')
        ).toBeTruthy();
        expect(
          tree.exists('libs/my-dir/my-lib/src/lib/MyDirMyLib.spec.ts')
        ).toBeTruthy();
      });
    });
  });

  describe('--linter', () => {
    it('should add eslint dependencies', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'myLib',
      });

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies['eslint']).toBeDefined();
      expect(packageJson.devDependencies['@nrwl/linter']).toBeDefined();
      expect(
        packageJson.devDependencies['@nrwl/eslint-plugin-nx']
      ).toBeDefined();
    });

    describe('not nested', () => {
      it('should update configuration', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
        });
        expect(readProjectConfiguration(tree, 'my-lib').targets.lint).toEqual({
          executor: '@nrwl/linter:eslint',
          outputs: ['{options.outputFile}'],
          options: {
            lintFilePatterns: ['libs/my-lib/**/*.ts'],
          },
        });
      });

      it('should create a local .eslintrc.json', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
        });

        const eslintJson = readJson(tree, 'libs/my-lib/.eslintrc.json');
        expect(eslintJson).toMatchInlineSnapshot(`
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
      it('should update configuration', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          directory: 'myDir',
        });

        expect(
          readProjectConfiguration(tree, 'my-dir-my-lib').targets.lint
        ).toEqual({
          executor: '@nrwl/linter:eslint',
          outputs: ['{options.outputFile}'],
          options: {
            lintFilePatterns: ['libs/my-dir/my-lib/**/*.ts'],
          },
        });
      });

      it('should create a local .eslintrc.json', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          directory: 'myDir',
        });

        const eslintJson = readJson(tree, 'libs/my-dir/my-lib/.eslintrc.json');
        expect(eslintJson).toMatchInlineSnapshot(`
            Object {
              "extends": Array [
                "../../../.eslintrc.json",
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

    describe('--js flag', () => {
      it('should generate js files instead of ts files', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          js: true,
        });
        expect(tree.exists(`libs/my-lib/jest.config.js`)).toBeTruthy();
        expect(tree.exists('libs/my-lib/src/index.js')).toBeTruthy();
        expect(tree.exists('libs/my-lib/src/lib/my-lib.js')).toBeTruthy();
        expect(tree.exists('libs/my-lib/src/lib/my-lib.spec.js')).toBeTruthy();
      });

      it('should update tsconfig.json with compilerOptions.allowJs: true', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          js: true,
        });
        expect(
          readJson(tree, 'libs/my-lib/tsconfig.json').compilerOptions.allowJs
        ).toBeTruthy();
      });

      it('should update tsconfig.lib.json include with **/*.js glob', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          js: true,
        });
        expect(readJson(tree, 'libs/my-lib/tsconfig.lib.json').include).toEqual(
          ['**/*.ts', '**/*.js']
        );
      });

      it('should update root tsconfig.json with a js file path', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          js: true,
        });
        const tsconfigJson = readJson(tree, '/tsconfig.base.json');
        expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
          'libs/my-lib/src/index.js',
        ]);
      });

      it('should generate js files for nested libs as well', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          directory: 'myDir',
          js: true,
        });
        expect(tree.exists(`libs/my-dir/my-lib/jest.config.js`)).toBeTruthy();
        expect(tree.exists('libs/my-dir/my-lib/src/index.js')).toBeTruthy();
        expect(
          tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.js')
        ).toBeTruthy();
        expect(
          tree.exists('libs/my-dir/my-lib/src/lib/my-dir-my-lib.spec.js')
        ).toBeTruthy();
        expect(tree.exists('libs/my-dir/my-lib/src/index.js')).toBeTruthy();
      });

      it('should configure the project for linting js files', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          directory: 'myDir',
          js: true,
        });
        expect(
          readProjectConfiguration(tree, 'my-dir-my-lib').targets.lint.options
            .lintFilePatterns
        ).toEqual(['libs/my-dir/my-lib/**/*.js']);
        expect(readJson(tree, 'libs/my-dir/my-lib/.eslintrc.json'))
          .toMatchInlineSnapshot(`
                  Object {
                    "extends": Array [
                      "../../../.eslintrc.json",
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
  });

  describe('--unit-test-runner jest', () => {
    it('should generate test configuration', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'myLib',
        unitTestRunner: 'jest',
      });

      expect(tree.exists('libs/my-lib/tsconfig.spec.json')).toBeTruthy();
      expect(tree.exists('libs/my-lib/jest.config.js')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.spec.ts')).toBeTruthy();

      const projectConfig = readProjectConfiguration(tree, 'my-lib');
      expect(projectConfig.targets.test).toBeDefined();

      expect(tree.exists(`libs/my-lib/jest.config.js`)).toBeTruthy();
      expect(tree.read(`libs/my-lib/jest.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "module.exports = {
          displayName: 'my-lib',
          preset: '../../jest.preset.js',
          globals: {
            'ts-jest': {
              tsconfig: '<rootDir>/tsconfig.spec.json',
            }
          },
          transform: {
            '^.+\\\\\\\\.[tj]s$': 'ts-jest'
          },
          moduleFileExtensions: ['ts', 'js', 'html'],
          coverageDirectory: '../../coverage/libs/my-lib'
        };
        "
      `);
      const readme = tree.read('libs/my-lib/README.md', 'utf-8');
      expect(readme).toContain('nx test my-lib');
    });

    describe('--buildable', () => {
      it('should generate the build target', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          buildable: true,
          compiler: 'tsc',
        });

        const config = readProjectConfiguration(tree, 'my-lib');
        expect(config.targets.build).toEqual({
          executor: '@nrwl/js:tsc',
          options: {
            assets: ['libs/my-lib/*.md'],
            main: 'libs/my-lib/src/index.ts',
            outputPath: 'dist/libs/my-lib',
            tsConfig: 'libs/my-lib/tsconfig.lib.json',
          },
          outputs: ['{options.outputPath}'],
        });
      });

      it('should generate the build target for swc', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          buildable: true,
          compiler: 'swc',
        });

        const config = readProjectConfiguration(tree, 'my-lib');
        expect(config.targets.build).toEqual({
          executor: '@nrwl/js:swc',
          options: {
            assets: ['libs/my-lib/*.md'],
            main: 'libs/my-lib/src/index.ts',
            outputPath: 'dist/libs/my-lib',
            tsConfig: 'libs/my-lib/tsconfig.lib.json',
          },
          outputs: ['{options.outputPath}'],
        });
      });

      it('should generate swcrc for swc', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          buildable: true,
          compiler: 'swc',
        });

        expect(tree.exists('libs/my-lib/.lib.swcrc')).toBeTruthy();
      });

      it('should setup jest project using swc', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          buildable: true,
          compiler: 'swc',
        });

        const jestConfig = tree.read('libs/my-lib/jest.config.js').toString();
        expect(jestConfig).toContain('@swc/jest');
      });

      it('should generate a package.json file', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          buildable: true,
          compiler: 'tsc',
        });

        expect(tree.exists('libs/my-lib/package.json')).toBeTruthy();
      });
    });

    describe('--publishable', () => {
      it('should generate the build target', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          publishable: true,
          importPath: '@proj/my-lib',
          compiler: 'tsc',
        });

        const config = readProjectConfiguration(tree, 'my-lib');
        expect(config.targets.build).toEqual({
          executor: '@nrwl/js:tsc',
          options: {
            assets: ['libs/my-lib/*.md'],
            main: 'libs/my-lib/src/index.ts',
            outputPath: 'dist/libs/my-lib',
            tsConfig: 'libs/my-lib/tsconfig.lib.json',
          },
          outputs: ['{options.outputPath}'],
        });
      });

      it('should generate the publish target', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          publishable: true,
          importPath: '@proj/my-lib',
          compiler: 'tsc',
        });

        const config = readProjectConfiguration(tree, 'my-lib');
        expect(config.targets.publish).toEqual({
          executor: '@nrwl/workspace:run-commands',
          options: {
            command:
              'node tools/scripts/publish.mjs my-lib {args.ver} {args.tag}',
            cwd: 'dist/libs/my-lib',
          },
          dependsOn: [{ projects: 'self', target: 'build' }],
        });
      });

      it('should generate publish script', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          publishable: true,
          importPath: '@proj/my-lib',
          compiler: 'tsc',
        });

        expect(tree.exists('tools/scripts/publish.mjs')).toBeTruthy();
      });
    });
  });
});
