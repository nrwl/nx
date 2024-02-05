import * as devkit from '@nx/devkit';
import {
  getProjects,
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

// nx-ignore-next-line
import { applicationGenerator as angularApplicationGenerator } from '@nx/angular/generators';
import { Schema } from './schema';
import { applicationGenerator } from './application';

describe('app', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    jest.clearAllMocks();
  });

  describe('not nested', () => {
    it('should update project config', async () => {
      await applicationGenerator(tree, {
        name: 'my-node-app',
        bundler: 'webpack',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
      const project = readProjectConfiguration(tree, 'my-node-app');
      expect(project).toMatchInlineSnapshot(`
        {
          "$schema": "../node_modules/nx/schemas/project-schema.json",
          "name": "my-node-app",
          "projectType": "application",
          "root": "my-node-app",
          "sourceRoot": "my-node-app/src",
          "tags": [],
          "targets": {
            "serve": {
              "configurations": {
                "development": {
                  "buildTarget": "my-node-app:build:development",
                },
                "production": {
                  "buildTarget": "my-node-app:build:production",
                },
              },
              "defaultConfiguration": "development",
              "executor": "@nx/js:node",
              "options": {
                "buildTarget": "my-node-app:build",
              },
            },
          },
        }
      `);
      expect(() =>
        readProjectConfiguration(tree, 'my-node-app-e2e')
      ).not.toThrow();
    });

    it('should update tags', async () => {
      await applicationGenerator(tree, {
        name: 'my-node-app',
        tags: 'one,two',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
      const projects = Object.fromEntries(getProjects(tree));
      expect(projects).toMatchObject({
        'my-node-app': {
          tags: ['one', 'two'],
        },
      });
    });

    it('should generate files', async () => {
      await applicationGenerator(tree, {
        name: 'my-node-app',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
      expect(tree.exists(`my-node-app/jest.config.ts`)).toBeTruthy();
      expect(tree.exists('my-node-app/src/main.ts')).toBeTruthy();

      const tsconfig = readJson(tree, 'my-node-app/tsconfig.json');
      expect(tsconfig).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "esModuleInterop": true,
          },
          "extends": "../tsconfig.base.json",
          "files": [],
          "include": [],
          "references": [
            {
              "path": "./tsconfig.app.json",
            },
            {
              "path": "./tsconfig.spec.json",
            },
          ],
        }
      `);

      const tsconfigApp = readJson(tree, 'my-node-app/tsconfig.app.json');
      expect(tsconfigApp.compilerOptions.outDir).toEqual('../dist/out-tsc');
      expect(tsconfigApp.extends).toEqual('./tsconfig.json');
      expect(tsconfigApp.exclude).toEqual([
        'jest.config.ts',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
      ]);
      const eslintrc = readJson(tree, 'my-node-app/.eslintrc.json');
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

    it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
      tree.rename('tsconfig.base.json', 'tsconfig.json');

      await applicationGenerator(tree, {
        name: 'my-node-app',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });

      const tsconfig = readJson(tree, 'my-node-app/tsconfig.json');
      expect(tsconfig.extends).toBe('../tsconfig.json');
    });
  });

  describe('nested', () => {
    it('should update project config', async () => {
      await applicationGenerator(tree, {
        name: 'my-node-app',
        directory: 'my-dir/my-node-app',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
      const project = readProjectConfiguration(tree, 'my-node-app');

      expect(project).toMatchInlineSnapshot(`
        {
          "$schema": "../../node_modules/nx/schemas/project-schema.json",
          "name": "my-node-app",
          "projectType": "application",
          "root": "my-dir/my-node-app",
          "sourceRoot": "my-dir/my-node-app/src",
          "tags": [],
          "targets": {
            "build": {
              "configurations": {
                "development": {},
                "production": {
                  "esbuildOptions": {
                    "outExtension": {
                      ".js": ".js",
                    },
                    "sourcemap": false,
                  },
                },
              },
              "defaultConfiguration": "production",
              "executor": "@nx/esbuild:esbuild",
              "options": {
                "assets": [
                  "my-dir/my-node-app/src/assets",
                ],
                "bundle": false,
                "esbuildOptions": {
                  "outExtension": {
                    ".js": ".js",
                  },
                  "sourcemap": true,
                },
                "format": [
                  "cjs",
                ],
                "generatePackageJson": true,
                "main": "my-dir/my-node-app/src/main.ts",
                "outputPath": "dist/my-dir/my-node-app",
                "platform": "node",
                "tsConfig": "my-dir/my-node-app/tsconfig.app.json",
              },
              "outputs": [
                "{options.outputPath}",
              ],
            },
            "serve": {
              "configurations": {
                "development": {
                  "buildTarget": "my-node-app:build:development",
                },
                "production": {
                  "buildTarget": "my-node-app:build:production",
                },
              },
              "defaultConfiguration": "development",
              "executor": "@nx/js:node",
              "options": {
                "buildTarget": "my-node-app:build",
              },
            },
          },
        }
      `);

      expect(() =>
        readProjectConfiguration(tree, 'my-node-app-e2e')
      ).not.toThrow();
    });

    it('should update tags', async () => {
      await applicationGenerator(tree, {
        name: 'my-node-app',
        directory: 'myDir',
        tags: 'one,two',
        addPlugin: true,
      });
      const projects = Object.fromEntries(getProjects(tree));
      expect(projects).toMatchObject({
        'my-dir-my-node-app': {
          tags: ['one', 'two'],
        },
      });
    });

    it('should generate files', async () => {
      const hasJsonValue = ({ path, expectedValue, lookupFn }) => {
        const config = readJson(tree, path);

        expect(lookupFn(config)).toEqual(expectedValue);
      };
      await applicationGenerator(tree, {
        name: 'my-node-app',
        directory: 'myDir',
        addPlugin: true,
      });

      // Make sure these exist
      [
        `my-dir/my-node-app/jest.config.ts`,
        'my-dir/my-node-app/src/main.ts',
      ].forEach((path) => {
        expect(tree.exists(path)).toBeTruthy();
      });

      // Make sure these have properties
      [
        {
          path: 'my-dir/my-node-app/tsconfig.app.json',
          lookupFn: (json) => json.compilerOptions.outDir,
          expectedValue: '../../dist/out-tsc',
        },
        {
          path: 'my-dir/my-node-app/tsconfig.app.json',
          lookupFn: (json) => json.compilerOptions.types,
          expectedValue: ['node'],
        },
        {
          path: 'my-dir/my-node-app/tsconfig.app.json',
          lookupFn: (json) => json.exclude,
          expectedValue: [
            'jest.config.ts',
            'src/**/*.spec.ts',
            'src/**/*.test.ts',
          ],
        },
        {
          path: 'my-dir/my-node-app/.eslintrc.json',
          lookupFn: (json) => json.extends,
          expectedValue: ['../../.eslintrc.json'],
        },
      ].forEach(hasJsonValue);
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await applicationGenerator(tree, {
        name: 'my-node-app',
        unitTestRunner: 'none',
        addPlugin: true,
      });
      expect(tree.exists('jest.config.ts')).toBeFalsy();
      expect(tree.exists('my-node-app/src/test-setup.ts')).toBeFalsy();
      expect(tree.exists('my-node-app/src/test.ts')).toBeFalsy();
      expect(tree.exists('my-node-app/tsconfig.spec.json')).toBeFalsy();
      expect(tree.exists('my-node-app/jest.config.ts')).toBeFalsy();
    });
  });

  describe('--frontendProject', () => {
    it('should configure proxy', async () => {
      await angularApplicationGenerator(tree, {
        name: 'my-frontend',
        addPlugin: true,
      });

      await applicationGenerator(tree, {
        name: 'my-node-app',
        frontendProject: 'my-frontend',
        addPlugin: true,
      });

      expect(tree.exists('my-frontend/proxy.conf.json')).toBeTruthy();
      const project = readProjectConfiguration(tree, 'my-frontend');
      const serve = project.targets.serve;
      expect(serve.options.proxyConfig).toEqual('my-frontend/proxy.conf.json');
    });

    it('should configure proxies for multiple node projects with the same frontend app', async () => {
      await angularApplicationGenerator(tree, {
        name: 'my-frontend',
        addPlugin: true,
      });

      await applicationGenerator(tree, {
        name: 'cart',
        frontendProject: 'my-frontend',
        addPlugin: true,
      });

      await applicationGenerator(tree, {
        name: 'billing',
        frontendProject: 'my-frontend',
        addPlugin: true,
      });

      expect(tree.exists('my-frontend/proxy.conf.json')).toBeTruthy();

      expect(readJson(tree, 'my-frontend/proxy.conf.json')).toEqual({
        '/api': { target: 'http://localhost:3000', secure: false },
        '/billing-api': { target: 'http://localhost:3000', secure: false },
      });
    });

    it('should work with unnormalized project names', async () => {
      await angularApplicationGenerator(tree, {
        name: 'myFrontend',
        addPlugin: true,
      });

      await applicationGenerator(tree, {
        name: 'my-node-app',
        frontendProject: 'myFrontend',
        addPlugin: true,
      });

      expect(tree.exists('my-frontend/proxy.conf.json')).toBeTruthy();
      const project = readProjectConfiguration(tree, 'my-frontend');
      const serve = project.targets.serve;
      expect(serve.options.proxyConfig).toEqual('my-frontend/proxy.conf.json');
    });
  });

  describe('--swcJest', () => {
    it('should use @swc/jest for jest', async () => {
      await applicationGenerator(tree, {
        name: 'my-node-app',
        tags: 'one,two',
        swcJest: true,
        addPlugin: true,
      } as Schema);

      expect(tree.read(`my-node-app/jest.config.ts`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "/* eslint-disable */
        export default {
          displayName: 'my-node-app',
          preset: '../jest.preset.js',
          testEnvironment: 'node',
          transform: {
            '^.+\\\\.[tj]s$': '@swc/jest',
          },
          moduleFileExtensions: ['ts', 'js', 'html'],
          coverageDirectory: '../coverage/my-node-app',
        };
        "
      `);
    });
  });

  describe('--babelJest (deprecated)', () => {
    it('should use babel for jest', async () => {
      await applicationGenerator(tree, {
        name: 'my-node-app',
        tags: 'one,two',
        babelJest: true,
        addPlugin: true,
      } as Schema);

      expect(tree.read(`my-node-app/jest.config.ts`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "/* eslint-disable */
        export default {
          displayName: 'my-node-app',
          preset: '../jest.preset.js',
          testEnvironment: 'node',
          transform: {
            '^.+\\\\.[tj]s$': 'babel-jest',
          },
          moduleFileExtensions: ['ts', 'js', 'html'],
          coverageDirectory: '../coverage/my-node-app',
        };
        "
      `);
    });
  });

  describe('--js flag', () => {
    it('should generate js files instead of ts files', async () => {
      await applicationGenerator(tree, {
        name: 'my-node-app',
        js: true,
        addPlugin: true,
      } as Schema);

      expect(tree.exists(`my-node-app/jest.config.js`)).toBeTruthy();
      expect(tree.exists('my-node-app/src/main.js')).toBeTruthy();

      const tsConfig = readJson(tree, 'my-node-app/tsconfig.json');
      expect(tsConfig.compilerOptions).toEqual({
        allowJs: true,
        esModuleInterop: true,
      });

      const tsConfigApp = readJson(tree, 'my-node-app/tsconfig.app.json');
      expect(tsConfigApp.include).toEqual(['src/**/*.ts', 'src/**/*.js']);
      expect(tsConfigApp.exclude).toEqual([
        'jest.config.ts',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.js',
        'src/**/*.test.js',
      ]);
    });

    it('should add project config', async () => {
      await applicationGenerator(tree, {
        name: 'my-node-app',
        js: true,
        addPlugin: true,
      } as Schema);
      const project = readProjectConfiguration(tree, 'my-node-app');
      const buildTarget = project.targets.build;

      expect(buildTarget.options.main).toEqual('my-node-app/src/main.js');
    });

    it('should generate js files for nested libs as well', async () => {
      await applicationGenerator(tree, {
        name: 'my-node-app',
        directory: 'myDir',
        js: true,
        addPlugin: true,
      } as Schema);
      expect(tree.exists(`my-dir/my-node-app/jest.config.js`)).toBeTruthy();
      expect(tree.exists('my-dir/my-node-app/src/main.js')).toBeTruthy();
    });
  });

  describe('--pascalCaseFiles', () => {
    it(`should notify that this flag doesn't do anything`, async () => {
      await applicationGenerator(tree, {
        name: 'my-node-app',
        pascalCaseFiles: true,
        addPlugin: true,
      } as Schema);

      // @TODO how to spy on context ?
      // expect(contextLoggerSpy).toHaveBeenCalledWith('NOTE: --pascalCaseFiles is a noop')
    });
  });

  describe('--skipFormat', () => {
    it('should format files by default', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await applicationGenerator(tree, {
        name: 'my-node-app',
        addPlugin: true,
      });

      expect(devkit.formatFiles).toHaveBeenCalled();
    });

    it('should not format files when --skipFormat=true', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await applicationGenerator(tree, {
        name: 'my-node-app',
        skipFormat: true,
        addPlugin: true,
      });

      expect(devkit.formatFiles).not.toHaveBeenCalled();
    });
  });

  describe.each([
    ['fastify' as const, true],
    ['express' as const, false],
    ['koa' as const, false],
    ['nest' as const, false],
  ])('--unitTestRunner', (framework, checkSpecFile) => {
    it('should generate test target and spec file by default', async () => {
      await applicationGenerator(tree, {
        name: 'api',
        framework,
        addPlugin: true,
      });

      expect(tree.exists(`api/jest.config.ts`)).toBeTruthy();

      if (checkSpecFile) {
        expect(tree.exists(`api/src/app/app.spec.ts`)).toBeTruthy();
      }
    });
  });
});
