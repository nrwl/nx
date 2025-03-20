import 'nx/src/internal-testing-utils/mock-project-graph';

import * as devkit from '@nx/devkit';
import {
  getProjects,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  writeJson,
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
        directory: 'my-node-app',
        bundler: 'webpack',
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
              "continuous": true,
              "defaultConfiguration": "development",
              "dependsOn": [
                "build",
              ],
              "executor": "@nx/js:node",
              "options": {
                "buildTarget": "my-node-app:build",
                "runBuildTargetDependencies": false,
              },
            },
            "test": {
              "options": {
                "passWithNoTests": true,
              },
            },
          },
        }
      `);
      expect(tree.read(`my-node-app/webpack.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
        const { join } = require('path');

        module.exports = {
          output: {
            path: join(__dirname, '../dist/my-node-app'),
          },
          plugins: [
            new NxAppWebpackPlugin({
              target: 'node',
              compiler: 'tsc',
              main: './src/main.ts',
              tsConfig: './tsconfig.app.json',
              assets: ['./src/assets'],
              optimization: false,
              outputHashing: 'none',
              generatePackageJson: true,
            }),
          ],
        };
        "
      `);
      expect(() =>
        readProjectConfiguration(tree, 'my-node-app-e2e')
      ).not.toThrow();
    });

    it('should update tags', async () => {
      await applicationGenerator(tree, {
        directory: 'my-node-app',
        tags: 'one,two',
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
        directory: 'my-node-app',
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
        directory: 'my-node-app',
        addPlugin: true,
      });

      const tsconfig = readJson(tree, 'my-node-app/tsconfig.json');
      expect(tsconfig.extends).toBe('../tsconfig.json');
    });
  });

  describe('nested', () => {
    it('should update project config', async () => {
      await applicationGenerator(tree, {
        directory: 'my-dir/my-node-app',
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
              "continuous": true,
              "defaultConfiguration": "development",
              "dependsOn": [
                "build",
              ],
              "executor": "@nx/js:node",
              "options": {
                "buildTarget": "my-node-app:build",
                "runBuildTargetDependencies": false,
              },
            },
            "test": {
              "options": {
                "passWithNoTests": true,
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
        'my-node-app': {
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
        directory: 'my-dir/my-node-app/',
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
        directory: 'my-node-app',
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
        directory: 'my-frontend',
      });

      await applicationGenerator(tree, {
        directory: 'my-node-app',
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
        directory: 'my-frontend',
      });

      await applicationGenerator(tree, {
        directory: 'cart',
        frontendProject: 'my-frontend',
        addPlugin: true,
      });

      await applicationGenerator(tree, {
        directory: 'billing',
        frontendProject: 'my-frontend',
        addPlugin: true,
      });

      expect(tree.exists('my-frontend/proxy.conf.json')).toBeTruthy();

      expect(readJson(tree, 'my-frontend/proxy.conf.json')).toEqual({
        '/api': { target: 'http://localhost:3000', secure: false },
        '/billing-api': { target: 'http://localhost:3000', secure: false },
      });
    });
  });

  describe('--swcJest', () => {
    it('should use @swc/jest for jest', async () => {
      await applicationGenerator(tree, {
        directory: 'my-node-app',
        tags: 'one,two',
        swcJest: true,
        addPlugin: true,
      } as Schema);

      expect(tree.read(`my-node-app/jest.config.ts`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "export default {
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
        directory: 'my-node-app',
        tags: 'one,two',
        babelJest: true,
        addPlugin: true,
      } as Schema);

      expect(tree.read(`my-node-app/jest.config.ts`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "export default {
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
        directory: 'my-node-app',
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
        'jest.config.js',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.js',
        'src/**/*.test.js',
      ]);
    });

    it('should add project config', async () => {
      await applicationGenerator(tree, {
        directory: 'my-node-app',
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
        directory: 'my-dir/my-node-app/',
        js: true,
        addPlugin: true,
      } as Schema);
      expect(tree.exists(`my-dir/my-node-app/jest.config.js`)).toBeTruthy();
      expect(tree.exists('my-dir/my-node-app/src/main.js')).toBeTruthy();
    });
  });

  describe('--skipFormat', () => {
    it('should format files by default', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await applicationGenerator(tree, {
        directory: 'my-node-app',
        addPlugin: true,
      });

      expect(devkit.formatFiles).toHaveBeenCalled();
    });

    it('should not format files when --skipFormat=true', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await applicationGenerator(tree, {
        directory: 'my-node-app',
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
        directory: 'api',
        framework,
        addPlugin: true,
      });

      expect(tree.exists(`api/jest.config.ts`)).toBeTruthy();

      if (checkSpecFile) {
        expect(tree.exists(`api/src/app/app.spec.ts`)).toBeTruthy();
      }
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
      await applicationGenerator(tree, {
        directory: 'myapp',
        bundler: 'webpack',
        unitTestRunner: 'jest',
        addPlugin: true,
        useProjectJson: false,
      });

      expect(readJson(tree, 'tsconfig.json').references).toMatchInlineSnapshot(`
        [
          {
            "path": "./myapp-e2e",
          },
          {
            "path": "./myapp",
          },
        ]
      `);
      const packageJson = readJson(tree, 'myapp/package.json');
      expect(packageJson.name).toBe('@proj/myapp');
      expect(packageJson.nx.name).toBeUndefined();
      // Make sure keys are in idiomatic order
      expect(Object.keys(packageJson)).toMatchInlineSnapshot(`
        [
          "name",
          "version",
          "private",
          "nx",
        ]
      `);
      expect(readJson(tree, 'myapp/package.json')).toMatchInlineSnapshot(`
        {
          "name": "@proj/myapp",
          "nx": {
            "targets": {
              "serve": {
                "configurations": {
                  "development": {
                    "buildTarget": "@proj/myapp:build:development",
                  },
                  "production": {
                    "buildTarget": "@proj/myapp:build:production",
                  },
                },
                "continuous": true,
                "defaultConfiguration": "development",
                "dependsOn": [
                  "build",
                ],
                "executor": "@nx/js:node",
                "options": {
                  "buildTarget": "@proj/myapp:build",
                  "runBuildTargetDependencies": false,
                },
              },
              "test": {
                "options": {
                  "passWithNoTests": true,
                },
              },
            },
          },
          "private": true,
          "version": "0.0.1",
        }
      `);
      expect(readJson(tree, 'myapp/tsconfig.json')).toMatchInlineSnapshot(`
        {
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
      expect(readJson(tree, 'myapp/tsconfig.app.json')).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "module": "nodenext",
            "moduleResolution": "nodenext",
            "outDir": "dist",
            "rootDir": "src",
            "tsBuildInfoFile": "dist/tsconfig.app.tsbuildinfo",
            "types": [
              "node",
            ],
          },
          "exclude": [
            "out-tsc",
            "dist",
            "jest.config.ts",
            "src/**/*.spec.ts",
            "src/**/*.test.ts",
            "eslint.config.js",
            "eslint.config.cjs",
            "eslint.config.mjs",
          ],
          "extends": "../tsconfig.base.json",
          "include": [
            "src/**/*.ts",
          ],
        }
      `);
      expect(readJson(tree, 'myapp/tsconfig.spec.json')).toMatchInlineSnapshot(`
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
              "path": "./tsconfig.app.json",
            },
          ],
        }
      `);
    });

    it('should respect the provided name', async () => {
      await applicationGenerator(tree, {
        directory: 'myapp',
        name: 'myapp',
        bundler: 'webpack',
        unitTestRunner: 'jest',
        addPlugin: true,
        useProjectJson: false,
      });

      const packageJson = readJson(tree, 'myapp/package.json');
      expect(packageJson.name).toBe('@proj/myapp');
      expect(packageJson.nx.name).toBe('myapp');
      // Make sure keys are in idiomatic order
      expect(Object.keys(packageJson)).toMatchInlineSnapshot(`
        [
          "name",
          "version",
          "private",
          "nx",
        ]
      `);
    });

    it('should use @swc/jest for jest', async () => {
      await applicationGenerator(tree, {
        directory: 'apps/my-app',
        swcJest: true,
        useProjectJson: false,
      } as Schema);

      expect(tree.read('apps/my-app/jest.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "/* eslint-disable */
        import { readFileSync } from 'fs';

        // Reading the SWC compilation config for the spec files
        const swcJestConfig = JSON.parse(
          readFileSync(\`\${__dirname}/.spec.swcrc\`, 'utf-8')
        );

        // Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
        swcJestConfig.swcrc = false;

        export default {
          displayName: '@proj/my-app',
          preset: '../../jest.preset.js',
          testEnvironment: 'node',
          transform: {
            '^.+\\\\.[tj]s$': ['@swc/jest', swcJestConfig],
          },
          moduleFileExtensions: ['ts', 'js', 'html'],
          coverageDirectory: 'test-output/jest/coverage',
        };
        "
      `);
      expect(tree.read('apps/my-app/.spec.swcrc', 'utf-8'))
        .toMatchInlineSnapshot(`
        "{
          "jsc": {
            "target": "es2017",
            "parser": {
              "syntax": "typescript",
              "decorators": true,
              "dynamicImport": true
            },
            "transform": {
              "decoratorMetadata": true,
              "legacyDecorator": true
            },
            "keepClassNames": true,
            "externalHelpers": true,
            "loose": true
          },
          "module": {
            "type": "es6"
          },
          "sourceMaps": true,
          "exclude": []
        }
        "
      `);
    });

    it('should configure webpack correctly with the output contained within the project root', async () => {
      await applicationGenerator(tree, {
        directory: 'apps/my-app',
        bundler: 'webpack',
        addPlugin: true,
        useProjectJson: false,
        skipFormat: true,
      });

      expect(tree.read('apps/my-app/webpack.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
        const { join } = require('path');

        module.exports = {
          output: {
            path: join(__dirname, 'dist'),
          },
          plugins: [
            new NxAppWebpackPlugin({
              target: 'node',
              compiler: 'tsc',
              main: './src/main.ts',
              tsConfig: './tsconfig.app.json',
              assets: ["./src/assets"],
              optimization: false,
              outputHashing: 'none',
              generatePackageJson: true,
            })
          ],
        };
        "
      `);
    });

    it('should configure webpack build task correctly with the output contained within the project root', async () => {
      await applicationGenerator(tree, {
        directory: 'apps/my-app',
        bundler: 'webpack',
        addPlugin: false,
        useProjectJson: false,
        skipFormat: true,
      });

      expect(
        readProjectConfiguration(tree, '@proj/my-app').targets.build.options
          .outputPath
      ).toBe('apps/my-app/dist');
    });

    it('should configure esbuild build task correctly with the output contained within the project root', async () => {
      await applicationGenerator(tree, {
        directory: 'apps/my-app',
        bundler: 'esbuild',
        addPlugin: false,
        useProjectJson: false,
        skipFormat: true,
      });

      expect(
        readProjectConfiguration(tree, '@proj/my-app').targets.build.options
          .outputPath
      ).toBe('apps/my-app/dist');
    });

    it('should generate project.json if useProjectJson is true', async () => {
      await applicationGenerator(tree, {
        directory: 'myapp',
        bundler: 'webpack',
        unitTestRunner: 'jest',
        addPlugin: true,
        useProjectJson: true,
        skipFormat: true,
      });

      expect(tree.exists('myapp/project.json')).toBeTruthy();
      expect(readProjectConfiguration(tree, '@proj/myapp'))
        .toMatchInlineSnapshot(`
        {
          "$schema": "../node_modules/nx/schemas/project-schema.json",
          "name": "@proj/myapp",
          "projectType": "application",
          "root": "myapp",
          "sourceRoot": "myapp/src",
          "tags": [],
          "targets": {
            "serve": {
              "configurations": {
                "development": {
                  "buildTarget": "@proj/myapp:build:development",
                },
                "production": {
                  "buildTarget": "@proj/myapp:build:production",
                },
              },
              "continuous": true,
              "defaultConfiguration": "development",
              "dependsOn": [
                "build",
              ],
              "executor": "@nx/js:node",
              "options": {
                "buildTarget": "@proj/myapp:build",
                "runBuildTargetDependencies": false,
              },
            },
            "test": {
              "options": {
                "passWithNoTests": true,
              },
            },
          },
        }
      `);
      expect(readJson(tree, 'myapp/package.json').nx).toBeUndefined();
      expect(tree.exists('myapp-e2e/project.json')).toBeTruthy();
      expect(readProjectConfiguration(tree, '@proj/myapp-e2e'))
        .toMatchInlineSnapshot(`
        {
          "$schema": "../node_modules/nx/schemas/project-schema.json",
          "implicitDependencies": [
            "@proj/myapp",
          ],
          "name": "@proj/myapp-e2e",
          "projectType": "application",
          "root": "myapp-e2e",
          "targets": {
            "e2e": {
              "dependsOn": [
                "@proj/myapp:build",
              ],
              "executor": "@nx/jest:jest",
              "options": {
                "jestConfig": "myapp-e2e/jest.config.ts",
                "passWithNoTests": true,
              },
              "outputs": [
                "{workspaceRoot}/coverage/{e2eProjectRoot}",
              ],
            },
          },
        }
      `);
      expect(readJson(tree, 'myapp-e2e/package.json').nx).toBeUndefined();
    });
  });
});
