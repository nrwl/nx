import {
  readProjectConfiguration,
  getProjects,
  readJson,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { libraryGenerator } from './library';
import { Schema } from './schema.d';

describe('lib', () => {
  let tree: Tree;
  const defaultOptions: Omit<Schema, 'name'> = {
    skipTsConfig: false,
    unitTestRunner: 'jest',
    skipFormat: false,
    linter: 'eslint',
    simpleModuleName: false,
    testEnvironment: 'jsdom',
    js: false,
    pascalCaseFiles: false,
    strict: true,
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('workspace v2', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace(2);
    });

    it('should default to standalone project for first project', async () => {
      await libraryGenerator(tree, { ...defaultOptions, name: 'my-lib' });
      const workspaceJsonEntry = readJson(tree, 'workspace.json').projects[
        'my-lib'
      ];
      const projectConfig = readProjectConfiguration(tree, 'my-lib');
      expect(projectConfig.root).toEqual('libs/my-lib');
      expect(workspaceJsonEntry).toEqual('libs/my-lib');
    });

    it('should obey standalone === false for first project', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'my-lib',
        standaloneConfig: false,
      });
      const workspaceJsonEntry = readJson(tree, 'workspace.json').projects[
        'my-lib'
      ];
      const projectConfig = readProjectConfiguration(tree, 'my-lib');
      expect(projectConfig.root).toEqual('libs/my-lib');
      expect(projectConfig).toMatchObject(workspaceJsonEntry);
    });
  });

  // describe('workspace v1', () => {
  //   beforeEach(() => {
  //     tree = createTreeWithEmptyWorkspace(1);
  //   });
  //
  //   it('should default to inline project for first project', async () => {
  //     await libraryGenerator(tree, { ...defaultOptions, name: 'my-lib' });
  //     const workspaceJsonEntry = toNewFormat(readJson(tree, 'workspace.json'))
  //       .projects['my-lib'];
  //     const projectConfig = readProjectConfiguration(tree, 'my-lib');
  //     expect(projectConfig.root).toEqual('libs/my-lib');
  //     expect(projectConfig).toMatchObject(workspaceJsonEntry);
  //   });
  //
  //   it('should throw for standaloneConfig === true', async () => {
  //     const promise = libraryGenerator(tree, {
  //       standaloneConfig: true,
  //       name: 'my-lib',
  //     });
  //     await expect(promise).rejects.toThrow();
  //   });
  // });

  describe('not nested', () => {
    it('should update workspace.json', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'myLib',
      });
      const workspaceJson = readJson(tree, '/workspace.json');

      expect(workspaceJson.projects['my-lib'].root).toEqual('libs/my-lib');
      expect(workspaceJson.projects['my-lib'].architect.build).toBeUndefined();
    });

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

      const tsconfigJson = readJson(tree, '/tsconfig.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'libs/my-lib/src/index.ts',
      ]);
    });

    it('should update root tsconfig.json (no existing path mappings)', async () => {
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
            "noFallthroughCasesInSwitch": true,
            "noImplicitReturns": true,
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

    it('should extend the local tsconfig.json with tsconfig.spec.json', async () => {
      await libraryGenerator(tree, { ...defaultOptions, name: 'myLib' });
      const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.spec.json');
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });

    it('should extend the local tsconfig.json with tsconfig.lib.json', async () => {
      await libraryGenerator(tree, { ...defaultOptions, name: 'myLib' });
      const tsconfigJson = readJson(tree, 'libs/my-lib/tsconfig.lib.json');
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });

    it('should generate files', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'myLib',
      });

      expect(tree.exists(`libs/my-lib/jest.config.ts`)).toBeTruthy();
      expect(tree.read(`libs/my-lib/jest.config.ts`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "/* eslint-disable */
        export default {
          displayName: 'my-lib',
          preset: '../../jest.preset.js',
          globals: {
            'ts-jest': {
              tsconfig: '<rootDir>/tsconfig.spec.json',
            }
          },
          transform: {
            '^.+\\\\\\\\.[tj]sx?$': 'ts-jest'
          },
          moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
          coverageDirectory: '../../coverage/libs/my-lib'
        };
        "
      `);
      expect(tree.exists('libs/my-lib/src/index.ts')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.ts')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.spec.ts')).toBeTruthy();
      expect(tree.exists('libs/my-lib/README.md')).toBeTruthy();
      expect(tree.exists('libs/my-lib/package.json')).toBeFalsy();

      const ReadmeContent = tree.read('libs/my-lib/README.md', 'utf-8');
      expect(ReadmeContent).toContain('nx test my-lib');
    });

    it('should add project to the jest config', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'myLib',
      });
      const expectedRootJestConfig = `
        "import { getJestProjects } from '@nrwl/jest';

        export default {
        projects: getJestProjects()
        };"
      `;

      expect(tree.read('jest.config.ts', 'utf-8')).toMatchInlineSnapshot(
        expectedRootJestConfig
      );
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'myLib2',
      });

      expect(tree.read('jest.config.ts', 'utf-8')).toMatchInlineSnapshot(
        expectedRootJestConfig
      );
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
      expect(tree.exists(`libs/my-dir/my-lib/jest.config.ts`)).toBeTruthy();
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

    it('should update root tsconfig.base.json', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'myLib',
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

    it('should update root tsconfig.json when no tsconfig.base.json', async () => {
      tree.rename('tsconfig.base.json', 'tsconfig.json');

      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'myLib',
        directory: 'myDir',
      });

      const tsconfigJson = readJson(tree, '/tsconfig.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-dir/my-lib']).toEqual(
        ['libs/my-dir/my-lib/src/index.ts']
      );
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
      expect(tsconfigJson.extends).toBe('../../../tsconfig.base.json');
      expect(tsconfigJson.references).toEqual([
        {
          path: './tsconfig.lib.json',
        },
        {
          path: './tsconfig.spec.json',
        },
      ]);
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

  describe('--linter', () => {
    describe('eslint', () => {
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
        it('should update workspace.json', async () => {
          await libraryGenerator(tree, {
            ...defaultOptions,
            name: 'myLib',
          });

          const workspaceJson = readJson(tree, 'workspace.json');
          expect(workspaceJson.projects['my-lib'].architect.lint).toEqual({
            builder: '@nrwl/linter:eslint',
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
        it('should update workspace.json', async () => {
          await libraryGenerator(tree, {
            ...defaultOptions,
            name: 'myLib',
            directory: 'myDir',
          });

          const workspaceJson = readJson(tree, 'workspace.json');
          expect(
            workspaceJson.projects['my-dir-my-lib'].architect.lint
          ).toEqual({
            builder: '@nrwl/linter:eslint',
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

          const eslintJson = readJson(
            tree,
            'libs/my-dir/my-lib/.eslintrc.json'
          );
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
    });

    describe('tslint', () => {
      it('should add tslint dependencies', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          linter: 'tslint',
        });

        const packageJson = readJson(tree, 'package.json');
        expect(packageJson.devDependencies['tslint']).toBeDefined();
        expect(
          packageJson.devDependencies['@angular-devkit/build-angular']
        ).toBeDefined();
      });

      it('should update workspace.json', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          directory: 'myDir',
          linter: 'tslint',
        });

        const workspaceJson = readJson(tree, 'workspace.json');
        expect(workspaceJson.projects['my-dir-my-lib'].architect.lint).toEqual({
          builder: '@angular-devkit/build-angular:tslint',
          options: {
            exclude: ['**/node_modules/**', '!libs/my-dir/my-lib/**/*'],
            tsConfig: [
              'libs/my-dir/my-lib/tsconfig.lib.json',
              'libs/my-dir/my-lib/tsconfig.spec.json',
            ],
          },
        });
      });

      it('should create a local tslint.json', async () => {
        await libraryGenerator(tree, {
          ...defaultOptions,
          name: 'myLib',
          directory: 'myDir',
          linter: 'tslint',
        });
        const tslintJson = readJson(tree, 'libs/my-dir/my-lib/tslint.json');
        expect(tslintJson).toMatchInlineSnapshot(`
          Object {
            "extends": "../../../tslint.json",
            "linterOptions": Object {
              "exclude": Array [
                "!**/*",
              ],
            },
            "rules": Object {},
          }
        `);
      });
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration nor spec file', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'myLib',
        unitTestRunner: 'none',
      });

      expect(tree.exists('libs/my-lib/tsconfig.spec.json')).toBeFalsy();
      expect(tree.exists('libs/my-lib/jest.config.ts')).toBeFalsy();
      expect(tree.exists('libs/my-lib/src/lib/my-lib.spec.ts')).toBeFalsy();

      const workspaceJson = readJson(tree, 'workspace.json');
      expect(workspaceJson.projects['my-lib'].architect.test).toBeUndefined();
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

  describe('--strict', () => {
    it('should update the projects tsconfig with strict false', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'myLib',
        strict: false,
      });
      const tsconfigJson = readJson(tree, '/libs/my-lib/tsconfig.json');

      expect(tsconfigJson.compilerOptions?.strict).not.toBeDefined();
      expect(
        tsconfigJson.compilerOptions?.forceConsistentCasingInFileNames
      ).not.toBeDefined();
      expect(tsconfigJson.compilerOptions?.noImplicitReturns).not.toBeDefined();
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
        readJson(tree, 'libs/my-lib/tsconfig.json').compilerOptions
      ).toEqual({
        forceConsistentCasingInFileNames: true,
        noFallthroughCasesInSwitch: true,
        noImplicitReturns: true,
        strict: true,
        allowJs: true,
      });
    });

    it('should update tsconfig.lib.json include with **/*.js glob', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'myLib',
        js: true,
      });
      expect(readJson(tree, 'libs/my-lib/tsconfig.lib.json').include).toEqual([
        '**/*.ts',
        '**/*.js',
      ]);
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
        readJson(tree, 'workspace.json').projects['my-dir-my-lib'].architect
          .lint.options.lintFilePatterns
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

  describe(`--babelJest`, () => {
    it('should use babel for jest', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'myLib',
        babelJest: true,
      } as Schema);

      expect(tree.read(`libs/my-lib/jest.config.ts`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "/* eslint-disable */
        export default {
          displayName: 'my-lib',
          preset: '../../jest.preset.js',
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

  describe('--skipBabelrc', () => {
    it('should skip generating .babelrc when --skipBabelrc=true', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'myLib',
        skipBabelrc: true,
      });
      expect(tree.exists('libs/my-lib/.babelrc')).toBeFalsy();
    });

    it('should generate .babelrc by default', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'myLib',
      });
      expect(tree.exists('libs/my-lib/.babelrc')).toBeTruthy();
    });
  });

  describe('--buildable', () => {
    it('should add build target to workspace.json', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'myLib',
        buildable: true,
      });
      const workspaceJson = readJson(tree, '/workspace.json');

      expect(workspaceJson.projects['my-lib'].root).toEqual('libs/my-lib');
      expect(workspaceJson.projects['my-lib'].architect.build).toBeTruthy();
      expect(workspaceJson.projects['my-lib'].architect.build.builder).toBe(
        '@nrwl/js:tsc'
      );
    });

    it('should generate a package.json file', async () => {
      await libraryGenerator(tree, {
        ...defaultOptions,
        name: 'myLib',
        buildable: true,
      });

      expect(tree.exists('libs/my-lib/package.json')).toBeTruthy();
    });
  });
});
