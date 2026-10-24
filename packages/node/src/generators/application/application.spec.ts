import type { Mock, MockInstance } from 'vitest';
// Mock `@nx/devkit` so that (1) the project graph is empty during generation and
// (2) the detected package manager can be pinned. `beforeEach` pins it to npm,
// which keeps inferred lock-file outputs (e.g. prune-lockfile) deterministic
// regardless of which package manager runs the tests. Individual tests can
// override `detectPackageManager`.
vi.mock('@nx/devkit', async () => {
  const actual = await vi.importActual<any>('@nx/devkit');
  return {
    ...actual,
    createProjectGraphAsync: vi
      .fn()
      .mockResolvedValue({ nodes: {}, dependencies: {} }),
    detectPackageManager: vi.fn(),
    getPackageManagerCommand: vi.fn((pm = 'npm') =>
      actual.getPackageManagerCommand(pm)
    ),
  };
});

import {
  detectPackageManager,
  getProjects,
  readJson,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import * as devkit from '@nx/devkit';
import { withPnpm } from '@nx/devkit/internal-testing-utils';
import {
  PNPM_INSTALL_SETTINGS_INPUTS,
  TS_SOLUTION_SETUP_TSCONFIG_INPUT,
} from '@nx/js/internal';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

// nx-ignore-next-line
import { applicationGenerator as angularApplicationGenerator } from '@nx/angular/generators';
import { Schema } from './schema';
import { applicationGenerator } from './application';

describe('app', () => {
  let tree: Tree;
  let envBackup: string | undefined;

  beforeEach(() => {
    envBackup = process.env.ESLINT_USE_FLAT_CONFIG;
    delete process.env.ESLINT_USE_FLAT_CONFIG;
    tree = createTreeWithEmptyWorkspace();

    vi.clearAllMocks();
    // `clearAllMocks` keeps configured return values, so re-pin the default.
    (detectPackageManager as Mock).mockReturnValue('npm');
  });

  afterEach(() => {
    if (envBackup === undefined) {
      delete process.env.ESLINT_USE_FLAT_CONFIG;
    } else {
      process.env.ESLINT_USE_FLAT_CONFIG = envBackup;
    }
  });

  describe('ready signal', () => {
    it.each([
      ['express', 'emitReadySignal(server)'],
      ['fastify', 'emitReadySignal(server.server)'],
      ['koa', 'emitReadySignal(server)'],
    ] as const)(
      'should report readiness from a %s server',
      async (framework, call) => {
        await applicationGenerator(tree, {
          directory: 'my-node-app',
          framework,
          bundler: 'webpack',
          skipFormat: true,
        });

        expect(
          readProjectConfiguration(tree, 'my-node-app').targets.serve.readyWhen
        ).toEqual({ signal: true });
        const main = tree.read('my-node-app/src/main.ts', 'utf-8');
        expect(main).toContain("load('@nx/js/ready-signal')");
        expect(main).toContain(call);
        expect(
          readJson(tree, 'package.json').devDependencies['@nx/js']
        ).toBeDefined();
      }
    );

    it('should not wait for an app without a server', async () => {
      await applicationGenerator(tree, {
        directory: 'my-node-app',
        framework: 'none',
        bundler: 'webpack',
        skipFormat: true,
      });

      expect(
        readProjectConfiguration(tree, 'my-node-app').targets.serve.readyWhen
      ).toBeUndefined();
    });
  });

  describe('pnpm 11 build scripts', () => {
    beforeEach(() => {
      (detectPackageManager as Mock).mockReturnValue('pnpm');
    });

    it('should deny the esbuild build script for the esbuild bundler', async () => {
      await withPnpm(tree, '11.2.2', () =>
        applicationGenerator(tree, {
          directory: 'my-node-app',
          bundler: 'esbuild',
          framework: 'none',
          unitTestRunner: 'none',
          e2eTestRunner: 'none',
          linter: 'none',
        } as Schema)
      );

      expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toMatch(
        /['"]?esbuild['"]?: false/
      );
    });

    it('should not record an esbuild decision for the webpack bundler', async () => {
      await withPnpm(tree, '11.2.2', () =>
        applicationGenerator(tree, {
          directory: 'my-node-app',
          bundler: 'webpack',
          framework: 'none',
          unitTestRunner: 'none',
          e2eTestRunner: 'none',
          linter: 'none',
        } as Schema)
      );

      expect(tree.read('pnpm-workspace.yaml', 'utf-8') ?? '').not.toContain(
        'esbuild'
      );
    });
  });

  describe('not nested', () => {
    it('should update project config', async () => {
      await applicationGenerator(tree, {
        directory: 'my-node-app',
        bundler: 'webpack',
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
            "copy-workspace-modules": {
              "cache": true,
              "dependsOn": [
                "build",
              ],
              "executor": "@nx/js:copy-workspace-modules",
              "options": {
                "buildTarget": "build",
              },
              "outputs": [
                "{workspaceRoot}/dist/my-node-app/workspace_modules",
              ],
            },
            "prune": {
              "dependsOn": [
                "prune-lockfile",
                "copy-workspace-modules",
              ],
              "executor": "nx:noop",
            },
            "prune-lockfile": {
              "cache": true,
              "dependsOn": [
                "build",
              ],
              "executor": "@nx/js:prune-lockfile",
              "options": {
                "buildTarget": "build",
              },
              "outputs": [
                "{workspaceRoot}/dist/my-node-app/package.json",
                "{workspaceRoot}/dist/my-node-app/package-lock.json",
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
      expect(tree.read(`my-node-app/webpack.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
        const { join } = require('path');

        module.exports = {
          output: {
            path: join(__dirname, '../dist/my-node-app'),
            clean: true,
            ...(process.env.NODE_ENV !== 'production' && {
              devtoolModuleFilenameTemplate: '[absolute-resource-path]',
            }),
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
              sourceMap: true,
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
        linter: 'eslint',
        directory: 'my-node-app',
      });
      expect(tree.exists(`my-node-app/jest.config.cts`)).toBeTruthy();
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
        'jest.config.cts',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
      ]);
      expect(tree.exists('my-node-app/eslint.config.mjs')).toBeTruthy();
    });

    it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
      tree.rename('tsconfig.base.json', 'tsconfig.json');

      await applicationGenerator(tree, {
        directory: 'my-node-app',
      });

      const tsconfig = readJson(tree, 'my-node-app/tsconfig.json');
      expect(tsconfig.extends).toBe('../tsconfig.json');
    });
  });

  describe('nested', () => {
    it('should update project config', async () => {
      await applicationGenerator(tree, {
        directory: 'my-dir/my-node-app',
        bundler: 'esbuild',
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
            "copy-workspace-modules": {
              "cache": true,
              "dependsOn": [
                "build",
              ],
              "executor": "@nx/js:copy-workspace-modules",
              "options": {
                "buildTarget": "build",
              },
              "outputs": [
                "{workspaceRoot}/dist/my-dir/my-node-app/workspace_modules",
              ],
            },
            "prune": {
              "dependsOn": [
                "prune-lockfile",
                "copy-workspace-modules",
              ],
              "executor": "nx:noop",
            },
            "prune-lockfile": {
              "cache": true,
              "dependsOn": [
                "build",
              ],
              "executor": "@nx/js:prune-lockfile",
              "options": {
                "buildTarget": "build",
              },
              "outputs": [
                "{workspaceRoot}/dist/my-dir/my-node-app/package.json",
                "{workspaceRoot}/dist/my-dir/my-node-app/package-lock.json",
              ],
            },
            "serve": {
              "continuous": true,
              "dependsOn": [
                "^build",
              ],
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
        linter: 'eslint',
        name: 'my-node-app',
        directory: 'my-dir/my-node-app/',
      });

      // Make sure these exist
      [
        `my-dir/my-node-app/jest.config.cts`,
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
            'jest.config.cts',
            'src/**/*.spec.ts',
            'src/**/*.test.ts',
          ],
        },
      ].forEach(hasJsonValue);
      expect(tree.exists('my-dir/my-node-app/eslint.config.mjs')).toBeTruthy();
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await applicationGenerator(tree, {
        directory: 'my-node-app',
        unitTestRunner: 'none',
      });
      expect(tree.exists('jest.config.cts')).toBeFalsy();
      expect(tree.exists('my-node-app/src/test-setup.ts')).toBeFalsy();
      expect(tree.exists('my-node-app/src/test.ts')).toBeFalsy();
      expect(tree.exists('my-node-app/tsconfig.spec.json')).toBeFalsy();
      expect(tree.exists('my-node-app/jest.config.cts')).toBeFalsy();
    });
  });

  describe('--unit-test-runner vitest', () => {
    it('should generate a vitest configuration', async () => {
      await applicationGenerator(tree, {
        directory: 'my-node-app',
        unitTestRunner: 'vitest',
        e2eTestRunner: 'none',
      });

      expect(tree.exists('my-node-app/vitest.config.mts')).toBeTruthy();
      expect(tree.exists('my-node-app/jest.config.cts')).toBeFalsy();
      expect(tree.read('my-node-app/vitest.config.mts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { defineConfig } from 'vitest/config';

        export default defineConfig(() => ({
          root: import.meta.dirname,
          cacheDir: '../node_modules/.vite/my-node-app',
          resolve: {
            tsconfigPaths: true,
          },
          test: {
            name: 'my-node-app',
            watch: false,
            globals: true,
            environment: 'node',
            include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
            passWithNoTests: true,
            reporters: ['default'],
            coverage: {
              reportsDirectory: '../coverage/my-node-app',
              provider: 'v8' as const,
            },
          },
        }));
        "
      `);
    });

    it('should set up the spec tsconfig for vitest', async () => {
      await applicationGenerator(tree, {
        directory: 'my-node-app',
        unitTestRunner: 'vitest',
        e2eTestRunner: 'none',
      });

      const tsConfig = readJson(tree, 'my-node-app/tsconfig.spec.json');
      expect(tsConfig.compilerOptions.types).toContain('vitest/globals');
    });

    it('should keep the generated spec file', async () => {
      await applicationGenerator(tree, {
        directory: 'api',
        framework: 'fastify',
        unitTestRunner: 'vitest',
        e2eTestRunner: 'none',
      });

      expect(tree.exists('api/src/app/app.spec.ts')).toBeTruthy();
    });

    it('should not add dependencies when --skipPackageJson', async () => {
      await applicationGenerator(tree, {
        directory: 'my-node-app',
        unitTestRunner: 'vitest',
        e2eTestRunner: 'none',
        skipPackageJson: true,
      });

      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies).not.toHaveProperty('vitest');
      expect(devDependencies).not.toHaveProperty('@vitest/coverage-v8');
    });
  });

  describe('--linter', () => {
    // The lint block used to be gated on `=== 'eslint'`, so asking for oxlint
    // skipped it entirely and produced an app with no linter and no error.
    // `@nx/nest:app` and `@nx/express:app` delegate here, so they broke too.
    it('should set up oxlint when asked for it', async () => {
      await applicationGenerator(tree, {
        directory: 'my-node-app',
        linter: 'oxlint',
        unitTestRunner: 'none',
        e2eTestRunner: 'none',
      });

      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies['oxlint']).toBeDefined();
      expect(devDependencies['@nx/oxlint']).toBeDefined();
      expect(tree.exists('.oxlintrc.json')).toBe(true);
    });

    it('should set up no linter for none', async () => {
      await applicationGenerator(tree, {
        directory: 'my-node-app',
        linter: 'none',
        unitTestRunner: 'none',
        e2eTestRunner: 'none',
      });

      const { devDependencies = {} } = readJson(tree, 'package.json');
      expect(devDependencies['oxlint']).toBeUndefined();
      expect(devDependencies['eslint']).toBeUndefined();
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
      });

      await applicationGenerator(tree, {
        directory: 'billing',
        frontendProject: 'my-frontend',
      });

      expect(tree.exists('my-frontend/proxy.conf.json')).toBeTruthy();

      expect(readJson(tree, 'my-frontend/proxy.conf.json')).toEqual({
        '/api': { target: 'http://localhost:3000', secure: false },
        '/billing-api': { target: 'http://localhost:3000', secure: false },
      });
    });
  });

  describe('eslintrc (legacy)', () => {
    it('should generate .eslintrc.json when ESLINT_USE_FLAT_CONFIG=false', async () => {
      process.env.ESLINT_USE_FLAT_CONFIG = 'false';
      await applicationGenerator(tree, {
        linter: 'eslint',
        directory: 'my-node-app',
      });
      const eslintrc = readJson(tree, 'my-node-app/.eslintrc.json');
      expect(eslintrc.extends).toEqual(['../.eslintrc.json']);
    });
  });

  describe('--swcJest', () => {
    it('should use @swc/jest for jest', async () => {
      await applicationGenerator(tree, {
        directory: 'my-node-app',
        tags: 'one,two',
        swcJest: true,
      } as Schema);

      expect(tree.read(`my-node-app/jest.config.cts`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "module.exports = {
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
      } as Schema);

      expect(tree.read(`my-node-app/jest.config.cts`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "module.exports = {
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
        bundler: 'esbuild',
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
      } as Schema);
      expect(tree.exists(`my-dir/my-node-app/jest.config.js`)).toBeTruthy();
      expect(tree.exists('my-dir/my-node-app/src/main.js')).toBeTruthy();
    });
  });

  describe('--skipFormat', () => {
    let formatFilesSpy: MockInstance;

    beforeEach(() => {
      formatFilesSpy = vi
        .spyOn(devkit, 'formatFiles')
        .mockImplementation(() => Promise.resolve());
    });

    afterAll(() => {
      vi.restoreAllMocks();
    });

    it('should format files by default', async () => {
      await applicationGenerator(tree, {
        directory: 'my-node-app',
      });

      expect(formatFilesSpy).toHaveBeenCalled();
    });

    it('should not format files when --skipFormat=true', async () => {
      await applicationGenerator(tree, {
        directory: 'my-node-app',
        skipFormat: true,
      });

      expect(formatFilesSpy).not.toHaveBeenCalled();
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
      });

      expect(tree.exists(`api/jest.config.cts`)).toBeTruthy();

      if (checkSpecFile) {
        expect(tree.exists(`api/src/app/app.spec.ts`)).toBeTruthy();
      }
    });
  });

  describe.each([
    ['fastify' as const, true],
    ['express' as const, false],
    ['koa' as const, false],
    ['nest' as const, false],
  ])('debug support', (framework, _) => {
    it('should generate a debug config for vscode by default', async () => {
      await applicationGenerator(tree, {
        directory: `api-${framework}`,
        framework,
      });
      const debugConfig = readJson(tree, '.vscode/launch.json');
      expect(debugConfig).toBeDefined();
      expect(debugConfig.configurations).toMatchSnapshot();
    });
  });

  describe('tsx serve', () => {
    it('should infer serve with tsx outside a TS solution workspace', async () => {
      await applicationGenerator(tree, {
        directory: 'myapp',
        framework: 'express',
        skipFormat: true,
      });

      expect(readProjectConfiguration(tree, 'myapp').targets.serve).toEqual({
        continuous: true,
        dependsOn: ['^build'],
        readyWhen: { signal: true },
      });
      expect(tree.read('myapp/src/main.ts', 'utf-8').split('\n').slice(0, 3))
        .toMatchInlineSnapshot(`
        [
          "#!/usr/bin/env tsx",
          "// @nx-target-name: serve",
          "import express from 'express';",
        ]
      `);
      expect(readNxJson(tree).plugins).toContain('@nx/js/tsx');
      expect(readJson(tree, 'package.json').devDependencies).toHaveProperty(
        'tsx'
      );
    });

    it('should leave an existing @nx/js/tsx registration alone, however scoped', async () => {
      const scoped = {
        plugin: '@nx/js/tsx',
        include: ['tools/**/*'],
        options: { watch: false },
      };
      updateNxJson(tree, { ...readNxJson(tree), plugins: [scoped] });
      await applicationGenerator(tree, {
        directory: 'myapp',
        e2eTestRunner: 'none',
        skipFormat: true,
      });

      expect(
        readNxJson(tree).plugins.filter(
          (p) => (typeof p === 'string' ? p : p.plugin) === '@nx/js/tsx'
        )
      ).toEqual([scoped]);
    });

    it('should reuse an unscoped @nx/js/tsx', async () => {
      updateNxJson(tree, { ...readNxJson(tree), plugins: ['@nx/js/tsx'] });
      await applicationGenerator(tree, {
        directory: 'myapp',
        skipFormat: true,
      });

      expect(
        readNxJson(tree).plugins.filter(
          (p) => (typeof p === 'string' ? p : p.plugin) === '@nx/js/tsx'
        )
      ).toEqual(['@nx/js/tsx']);
    });

    it('should keep the @nx/js:node serve target for webpack', async () => {
      await applicationGenerator(tree, {
        directory: 'myapp',
        bundler: 'webpack',
        skipFormat: true,
      });

      expect(
        readProjectConfiguration(tree, 'myapp').targets.serve.executor
      ).toBe('@nx/js:node');
      expect(tree.read('myapp/src/main.ts', 'utf-8')).not.toContain('#!');
      expect(
        (readNxJson(tree).plugins ?? []).some(
          (p) => (typeof p === 'string' ? p : p.plugin) === '@nx/js/tsx'
        )
      ).toBe(false);
    });
  });

  describe('bundler outside a TS solution workspace', () => {
    it('should default to rolldown', async () => {
      await applicationGenerator(tree, {
        directory: 'myapp',
        skipFormat: true,
      });

      expect(tree.exists('myapp/rolldown.config.ts')).toBe(true);
      expect(
        readProjectConfiguration(tree, 'myapp').targets.build
      ).toBeUndefined();
    });

    it('should write a project package.json for the prune targets', async () => {
      await applicationGenerator(tree, {
        directory: 'myapp',
        framework: 'express',
        skipFormat: true,
      });

      expect(readJson(tree, 'myapp/package.json')).toEqual(
        expect.objectContaining({
          private: true,
          dependencies: expect.objectContaining({
            express: expect.any(String),
          }),
        })
      );
      expect(tree.read('myapp/rolldown.config.ts', 'utf-8')).toContain(
        `import packageJson from './package.json' with { type: 'json' };`
      );
    });

    it('should default to esbuild for fastify', async () => {
      await applicationGenerator(tree, {
        directory: 'myapp',
        framework: 'fastify',
        skipFormat: true,
      });

      expect(
        readProjectConfiguration(tree, 'myapp').targets.build.executor
      ).toBe('@nx/esbuild:esbuild');
    });

    it('should throw for tsc', async () => {
      await expect(
        applicationGenerator(tree, {
          directory: 'myapp',
          bundler: 'tsc',
        })
      ).rejects.toThrow(/requires a TypeScript solution workspace/);
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
        linter: 'eslint',
        directory: 'myapp',
        bundler: 'webpack',
        unitTestRunner: 'jest',
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
          "dependencies",
          "nx",
        ]
      `);
      expect(readJson(tree, 'myapp/package.json')).toMatchInlineSnapshot(`
        {
          "dependencies": {},
          "name": "@proj/myapp",
          "nx": {
            "targets": {
              "copy-workspace-modules": {
                "cache": true,
                "dependsOn": [
                  "build",
                ],
                "executor": "@nx/js:copy-workspace-modules",
                "options": {
                  "buildTarget": "build",
                },
                "outputs": [
                  "{workspaceRoot}/myapp/dist/workspace_modules",
                ],
              },
              "prune": {
                "dependsOn": [
                  "prune-lockfile",
                  "copy-workspace-modules",
                ],
                "executor": "nx:noop",
              },
              "prune-lockfile": {
                "cache": true,
                "dependsOn": [
                  "build",
                ],
                "executor": "@nx/js:prune-lockfile",
                "options": {
                  "buildTarget": "build",
                },
                "outputs": [
                  "{workspaceRoot}/myapp/dist/package.json",
                  "{workspaceRoot}/myapp/dist/package-lock.json",
                ],
              },
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
            "jest.config.cts",
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
            "jest.config.cts",
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
          "dependencies",
          "nx",
        ]
      `);
    });

    it('should use @swc/jest for jest', async () => {
      await applicationGenerator(tree, {
        directory: 'apps/my-app',
        swcJest: true,
        unitTestRunner: 'jest',
        useProjectJson: false,
      } as Schema);

      expect(tree.read('apps/my-app/jest.config.cts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "/* eslint-disable */
        const { readFileSync } = require('fs');

        // Reading the SWC compilation config for the spec files
        const swcJestConfig = JSON.parse(readFileSync(\`\${__dirname}/.spec.swcrc\`, 'utf-8'));

        // Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
        swcJestConfig.swcrc = false;

        module.exports = {
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
            clean: true,
            ...(process.env.NODE_ENV !== 'production' && {
              devtoolModuleFilenameTemplate: '[absolute-resource-path]',
            }),
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
              generatePackageJson: false,
              sourceMap: true,
            })
          ],
        };
        "
      `);
    });

    it('should configure esbuild build task correctly with the output contained within the project root', async () => {
      await applicationGenerator(tree, {
        directory: 'apps/my-app',
        bundler: 'esbuild',
        useProjectJson: false,
        skipFormat: true,
      });

      expect(
        readProjectConfiguration(tree, '@proj/my-app').targets.build.options
          .outputPath
      ).toBe('apps/my-app/dist');
    });

    it('should default to an inferred tsc build', async () => {
      // Matches the TS solution base template.
      updateJson(tree, 'tsconfig.base.json', (json) => {
        json.compilerOptions.emitDeclarationOnly = true;
        return json;
      });
      await applicationGenerator(tree, {
        directory: 'apps/api',
        useProjectJson: false,
        skipFormat: true,
      });
      await applicationGenerator(tree, {
        directory: 'apps/worker',
        useProjectJson: false,
        skipFormat: true,
      });

      const project = readProjectConfiguration(tree, '@proj/api');
      expect(project.targets.build).toBeUndefined();
      expect(project.targets.serve).toEqual({
        continuous: true,
        dependsOn: ['^build'],
      });
      expect(
        readNxJson(tree).plugins.filter(
          (p) =>
            typeof p !== 'string' &&
            p.plugin === '@nx/js/typescript' &&
            p.options?.['build']?.configName === 'tsconfig.app.json'
        )
      ).toMatchInlineSnapshot(`
        [
          {
            "include": [
              "apps/api/*",
              "apps/worker/*",
            ],
            "options": {
              "build": {
                "buildDepsName": "build-deps",
                "configName": "tsconfig.app.json",
                "skipBuildCheck": true,
                "targetName": "build",
                "watchDepsName": "watch-deps",
              },
              "typecheck": false,
            },
            "plugin": "@nx/js/typescript",
          },
        ]
      `);
      expect(
        readJson(tree, 'apps/api/tsconfig.app.json').compilerOptions
      ).toMatchObject({
        outDir: 'dist',
        rootDir: 'src',
        emitDeclarationOnly: false,
      });
    });

    it('should use the target name of an existing rolldown registration', async () => {
      updateNxJson(tree, {
        ...readNxJson(tree),
        plugins: [
          {
            plugin: '@nx/rolldown/plugin',
            options: { buildTargetName: 'bundle' },
          },
        ],
      });

      await applicationGenerator(tree, {
        directory: 'apps/api',
        bundler: 'rolldown',
        docker: true,
        useProjectJson: false,
        skipFormat: true,
      });

      const targets = readProjectConfiguration(tree, '@proj/api').targets;
      expect(targets['prune-lockfile'].dependsOn).toEqual(['bundle']);
      expect(targets['prune-lockfile'].options.buildTarget).toBe('bundle');
      expect(targets['copy-workspace-modules'].options.buildTarget).toBe(
        'bundle'
      );
      expect(targets['docker:build'].dependsOn).toContain('bundle');
      const e2e = [...getProjects(tree).values()].find(
        (p) => p.root === 'apps/api-e2e'
      );
      expect(e2e.targets.e2e.dependsOn).toContain('@proj/api:bundle');
    });

    it('should throw for rolldown with fastify', async () => {
      await expect(
        applicationGenerator(tree, {
          directory: 'apps/api',
          bundler: 'rolldown',
          framework: 'fastify',
          useProjectJson: false,
          skipFormat: true,
        })
      ).rejects.toThrow(/does not support the "fastify" framework/);
    });

    it('should infer serve with node', async () => {
      await applicationGenerator(tree, {
        directory: 'apps/api',
        framework: 'express',
        useProjectJson: false,
        skipFormat: true,
      });

      expect(tree.read('apps/api/src/main.ts', 'utf-8')).toMatch(
        /^#!\/usr\/bin\/env node\n\/\/ @nx-target-name: serve\n/
      );
      expect(readNxJson(tree).plugins).toContain('@nx/js/node');
      expect(readJson(tree, 'package.json').devDependencies).not.toHaveProperty(
        'tsx'
      );
      expect(readJson(tree, 'apps/api/package.json').type).toBe('module');
      expect(
        readJson(tree, 'apps/api/tsconfig.app.json').compilerOptions
          .rewriteRelativeImportExtensions
      ).toBe(true);
    });

    it.each([
      ['--js', { js: true }],
      ['esbuild', { bundler: 'esbuild' as const }],
    ])('should keep tsx serve and CommonJS for %s', async (_, extra) => {
      await applicationGenerator(tree, {
        directory: 'apps/api',
        framework: 'express',
        useProjectJson: false,
        skipFormat: true,
        ...extra,
      });

      const main = tree.exists('apps/api/src/main.js')
        ? 'apps/api/src/main.js'
        : 'apps/api/src/main.ts';
      expect(tree.read(main, 'utf-8')).toMatch(/^#!\/usr\/bin\/env tsx\n/);
      expect(readJson(tree, 'apps/api/package.json').type).toBeUndefined();
    });

    it('should leave an existing @nx/js/node registration alone when it excludes the app', async () => {
      updateNxJson(tree, {
        ...readNxJson(tree),
        plugins: [{ plugin: '@nx/js/node', exclude: ['apps/**'] }],
      });

      await applicationGenerator(tree, {
        directory: 'apps/api',
        useProjectJson: false,
        skipFormat: true,
      });

      expect(
        readNxJson(tree).plugins.filter(
          (p) => (typeof p === 'string' ? p : p.plugin) === '@nx/js/node'
        )
      ).toEqual([{ plugin: '@nx/js/node', exclude: ['apps/**'] }]);
    });

    it('should use the target name of the rolldown registration that matches the app', async () => {
      updateNxJson(tree, {
        ...readNxJson(tree),
        plugins: [
          {
            plugin: '@nx/rolldown/plugin',
            include: ['lambda/**/*'],
            options: { buildTargetName: 'bundle' },
          },
          {
            plugin: '@nx/rolldown/plugin',
            exclude: ['lambda/**/*'],
            options: { buildTargetName: 'rolldown:build' },
          },
        ],
      });

      await applicationGenerator(tree, {
        directory: 'apps/api',
        bundler: 'rolldown',
        useProjectJson: false,
        skipFormat: true,
      });

      expect(
        readProjectConfiguration(tree, '@proj/api').targets['prune-lockfile']
          .options.buildTarget
      ).toBe('rolldown:build');
    });

    it('should register rolldown for the app when an existing one excludes it', async () => {
      updateNxJson(tree, {
        ...readNxJson(tree),
        plugins: [
          {
            plugin: '@nx/rolldown/plugin',
            exclude: ['apps/**'],
            options: { buildTargetName: 'bundle' },
          },
        ],
      });

      await applicationGenerator(tree, {
        directory: 'apps/api',
        bundler: 'rolldown',
        useProjectJson: false,
        skipFormat: true,
      });

      expect(readNxJson(tree).plugins).toContainEqual({
        plugin: '@nx/rolldown/plugin',
        include: ['apps/api/rolldown.config.ts'],
        options: { buildTargetName: 'build' },
      });
      expect(
        readProjectConfiguration(tree, '@proj/api').targets['prune-lockfile']
          .options.buildTarget
      ).toBe('build');
    });

    it('should let the tsc build compile a --js app', async () => {
      await applicationGenerator(tree, {
        directory: 'apps/api',
        js: true,
        useProjectJson: false,
        skipFormat: true,
      });

      const tsconfigApp = readJson(tree, 'apps/api/tsconfig.app.json');
      expect(tsconfigApp.include).toEqual(
        expect.arrayContaining([expect.stringMatching(/\.js$/)])
      );
      expect(tsconfigApp.compilerOptions.allowJs).toBe(true);
    });

    it('should serve fastify as ESM with node and test it with vitest', async () => {
      await applicationGenerator(tree, {
        directory: 'apps/api',
        framework: 'fastify',
        useProjectJson: false,
        skipFormat: true,
      });

      expect(tree.read('apps/api/src/main.ts', 'utf-8')).toMatch(
        /^#!\/usr\/bin\/env node\n[\s\S]*from '\.\/app\/app\.ts';/
      );
      expect(tree.read('apps/api/src/app/app.ts', 'utf-8')).toContain(
        "path.join(import.meta.dirname, 'routes')"
      );
      expect(tree.read('apps/api/src/app/app.spec.ts', 'utf-8')).toContain(
        "from './app.ts';"
      );
      expect(readJson(tree, 'apps/api/package.json').type).toBe('module');
      expect(tree.exists('apps/api/vitest.config.mts')).toBe(true);
      expect(readJson(tree, 'apps/api/tsconfig.spec.json').compilerOptions)
        .toMatchInlineSnapshot(`
        {
          "allowImportingTsExtensions": true,
          "module": "nodenext",
          "moduleResolution": "nodenext",
          "outDir": "./out-tsc/vitest",
          "types": [
            "vitest/globals",
            "vitest/importMeta",
            "vite/client",
            "node",
            "vitest",
          ],
        }
      `);
    });

    it('should serve jest apps as CommonJS with tsx', async () => {
      await applicationGenerator(tree, {
        directory: 'apps/api',
        framework: 'fastify',
        unitTestRunner: 'jest',
        e2eTestRunner: 'jest',
        useProjectJson: false,
        skipFormat: true,
      });

      expect(tree.read('apps/api/src/main.ts', 'utf-8')).toMatch(
        /^#!\/usr\/bin\/env tsx\n[\s\S]*from '\.\/app\/app';/
      );
      expect(readJson(tree, 'apps/api/package.json').type).toBeUndefined();
      expect(tree.exists('apps/api/jest.config.cts')).toBe(true);
      expect(tree.exists('apps/api-e2e/jest.config.cts')).toBe(true);
    });

    it('should default e2e tests to the vitest unit test runner', async () => {
      await applicationGenerator(tree, {
        directory: 'apps/api',
        framework: 'express',
        useProjectJson: false,
        skipFormat: true,
      });

      expect(tree.exists('apps/api-e2e/jest.config.ts')).toBe(false);
      expect(tree.exists('apps/api-e2e/jest.config.cts')).toBe(false);
      expect(tree.exists('apps/api-e2e/src/support/global-teardown.ts')).toBe(
        false
      );
      expect(tree.read('apps/api-e2e/vitest.config.mts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { defineConfig } from 'vitest/config';

        export default defineConfig({
          test: {
            name: '@proj/api-e2e',
            globals: true,
            environment: 'node',
            include: ['src/**/*.spec.ts'],
            globalSetup: ['src/support/global-setup.ts'],
            setupFiles: ['src/support/test-setup.ts'],
          },
        });
        "
      `);
      expect(readJson(tree, 'apps/api-e2e/package.json').nx.targets)
        .toMatchInlineSnapshot(`
        {
          "e2e": {
            "dependsOn": [
              "@proj/api:build",
              "@proj/api:serve",
            ],
          },
        }
      `);
      expect(
        readNxJson(tree).plugins.filter(
          (p) => typeof p !== 'string' && p.plugin === '@nx/vitest'
        )
      ).toMatchInlineSnapshot(`
        [
          {
            "exclude": [
              "apps/api-e2e/**/*",
            ],
            "options": {
              "ciTargetName": "test-ci",
              "testMode": "watch",
              "testTargetName": "test",
            },
            "plugin": "@nx/vitest",
          },
          {
            "include": [
              "apps/api-e2e/**/*",
            ],
            "options": {
              "ciTargetName": "e2e-ci",
              "testMode": "run",
              "testTargetName": "e2e",
            },
            "plugin": "@nx/vitest",
          },
        ]
      `);
      expect(readNxJson(tree).targetDefaults['e2e-ci--**/**'])
        .toMatchInlineSnapshot(`
        [
          {
            "dependsOn": [
              "@proj/api:build",
              "@proj/api:serve",
            ],
            "filter": {
              "projects": [
                "@proj/api-e2e",
              ],
            },
          },
        ]
      `);
    });

    it('should set up jest for explicit jest e2e tests alongside vitest unit tests', async () => {
      await applicationGenerator(tree, {
        directory: 'apps/api',
        framework: 'express',
        unitTestRunner: 'vitest',
        e2eTestRunner: 'jest',
        useProjectJson: false,
        skipFormat: true,
      });

      expect(tree.exists('apps/api-e2e/jest.config.cts')).toBe(true);
      expect(tree.read('jest.preset.js', 'utf-8')).toContain('@nx/jest/preset');
      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies).toEqual(
        expect.objectContaining({
          '@nx/jest': expect.any(String),
          jest: expect.any(String),
          '@swc/jest': expect.any(String),
          '@swc/core': expect.any(String),
        })
      );
    });

    it('should serve with tsx on node versions without native typescript', async () => {
      const nodeVersion = process.versions.node;
      Object.defineProperty(process.versions, 'node', { value: '22.17.0' });
      try {
        await applicationGenerator(tree, {
          directory: 'apps/api',
          framework: 'express',
          useProjectJson: false,
          skipFormat: true,
        });
      } finally {
        Object.defineProperty(process.versions, 'node', { value: nodeVersion });
      }

      expect(tree.read('apps/api/src/main.ts', 'utf-8')).toMatch(
        /^#!\/usr\/bin\/env tsx/
      );
      expect(readJson(tree, 'apps/api/package.json').type).toBeUndefined();
    });

    it('should use the target name of a reused tsc app build registration', async () => {
      updateNxJson(tree, {
        ...readNxJson(tree),
        plugins: [
          {
            plugin: '@nx/js/typescript',
            include: ['apps/other/*'],
            options: {
              typecheck: false,
              build: {
                targetName: 'compile',
                configName: 'tsconfig.app.json',
                skipBuildCheck: true,
              },
            },
          },
        ],
      });

      await applicationGenerator(tree, {
        directory: 'apps/api',
        useProjectJson: false,
        skipFormat: true,
      });

      const targets = readProjectConfiguration(tree, '@proj/api').targets;
      expect(targets['prune-lockfile'].options.buildTarget).toBe('compile');
      expect(
        readNxJson(tree).plugins.find(
          (p) => typeof p !== 'string' && p.plugin === '@nx/js/typescript'
        )
      ).toMatchObject({ include: ['apps/other/*', 'apps/api/*'] });
    });

    it('should configure an inferred rolldown build', async () => {
      await applicationGenerator(tree, {
        directory: 'apps/api',
        bundler: 'rolldown',
        useProjectJson: false,
        skipFormat: true,
      });

      expect(tree.read('apps/api/rolldown.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
          "import { defineConfig } from 'rolldown';
          import packageJson from './package.json' with { type: 'json' };

          // Installed at runtime instead of bundled (native addons, dynamic requires).
          const dependencies = Object.keys(packageJson.dependencies);

          export default defineConfig([
            {
              input: 'src/main.ts',
              platform: 'node',
              tsconfig: 'tsconfig.app.json',
              external: (id) =>
                dependencies.some((dep) => id === dep || id.startsWith(\`\${dep}/\`)),
              output: {
                dir: 'dist',
                cleanDir: true,
                format: 'esm',
                sourcemap: true,
              },
            },
          ]);
          "
        `);
      const project = readProjectConfiguration(tree, '@proj/api');
      expect(project.targets.build).toBeUndefined();
      expect(project.targets.serve).toEqual({
        continuous: true,
        dependsOn: ['^build'],
      });
      expect(
        readNxJson(tree).plugins.some(
          (p) => typeof p !== 'string' && p.plugin === '@nx/rolldown/plugin'
        )
      ).toBe(true);
      expect(readJson(tree, 'package.json').devDependencies).toHaveProperty(
        'rolldown'
      );
    });

    it('should generate project.json if useProjectJson is true', async () => {
      await applicationGenerator(tree, {
        linter: 'eslint',
        directory: 'myapp',
        bundler: 'webpack',
        unitTestRunner: 'jest',
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
            "copy-workspace-modules": {
              "cache": true,
              "dependsOn": [
                "build",
              ],
              "executor": "@nx/js:copy-workspace-modules",
              "options": {
                "buildTarget": "build",
              },
              "outputs": [
                "{workspaceRoot}/myapp/dist/workspace_modules",
              ],
            },
            "prune": {
              "dependsOn": [
                "prune-lockfile",
                "copy-workspace-modules",
              ],
              "executor": "nx:noop",
            },
            "prune-lockfile": {
              "cache": true,
              "dependsOn": [
                "build",
              ],
              "executor": "@nx/js:prune-lockfile",
              "options": {
                "buildTarget": "build",
              },
              "outputs": [
                "{workspaceRoot}/myapp/dist/package.json",
                "{workspaceRoot}/myapp/dist/package-lock.json",
              ],
            },
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
              "command": "jest --passWithNoTests",
              "dependsOn": [
                "@proj/myapp:build",
                "@proj/myapp:serve",
              ],
              "options": {
                "cwd": "myapp-e2e",
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

  describe('Nest.js with webpack bundler', () => {
    it('should not write an explicit build target since the inferred one handles NODE_ENV', async () => {
      await applicationGenerator(tree, {
        directory: 'my-nest-app',
        bundler: 'webpack',
        framework: 'nest',
      });

      const project = readProjectConfiguration(tree, 'my-nest-app');
      expect(project.targets.build).toBeUndefined();
    });
  });

  describe('--rootProject base compiler options', () => {
    it('should inline "bundler" moduleResolution into the root tsconfig.json when typescript is not declared', async () => {
      await applicationGenerator(tree, {
        name: 'my-node-app',
        directory: '.',
      });

      const { compilerOptions } = readJson(tree, 'tsconfig.json');
      // default tree has no declared typescript -> assumes the >=6 default
      expect(compilerOptions.moduleResolution).toBe('bundler');
      expect(compilerOptions.strict).toBe(false);
      // module and target come from the inlined base options
      expect(compilerOptions.module).toBe('esnext');
      expect(compilerOptions.target).toBe('es2015');
      // esModuleInterop is an explicit override on top of the base options
      expect(compilerOptions.esModuleInterop).toBe(true);
    });

    it('should inline "node10" moduleResolution into the root tsconfig.json when typescript is pinned below 6', async () => {
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        devDependencies: { ...json.devDependencies, typescript: '~5.9.2' },
      }));

      await applicationGenerator(tree, {
        name: 'my-node-app',
        directory: '.',
      });

      const { compilerOptions } = readJson(tree, 'tsconfig.json');
      // typescript <6 is declared -> node-family moduleResolution
      expect(compilerOptions.moduleResolution).toBe('node10');
      expect(compilerOptions.strict).toBe(false);
      expect(compilerOptions.esModuleInterop).toBe(true);
    });
  });

  describe('pnpm deploy-settings inputs', () => {
    beforeEach(() => {
      (detectPackageManager as Mock).mockReturnValue('pnpm');
      tree.write('pnpm-lock.yaml', 'lockfileVersion: 9.0\n');
    });

    it('adds them to the build target defaults in a pnpm workspace', async () => {
      await applicationGenerator(tree, {
        directory: 'app1',
        bundler: 'esbuild',
      });

      expect(
        readNxJson(tree).targetDefaults['@nx/esbuild:esbuild'].inputs
      ).toEqual([
        'default',
        '^default',
        TS_SOLUTION_SETUP_TSCONFIG_INPUT,
        ...PNPM_INSTALL_SETTINGS_INPUTS,
      ]);
    });

    it('appends them to a pre-existing build target defaults entry', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        '@nx/esbuild:esbuild': { cache: true, inputs: ['production'] },
      };
      updateNxJson(tree, nxJson);

      await applicationGenerator(tree, {
        directory: 'app1',
        bundler: 'esbuild',
      });

      expect(
        readNxJson(tree).targetDefaults['@nx/esbuild:esbuild'].inputs
      ).toEqual(['production', ...PNPM_INSTALL_SETTINGS_INPUTS]);
    });

    it('writes them onto the target when the existing defaults entry declares no inputs', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        '@nx/esbuild:esbuild': { cache: true },
      };
      updateNxJson(tree, nxJson);

      await applicationGenerator(tree, {
        directory: 'app1',
        bundler: 'esbuild',
      });

      expect(
        readProjectConfiguration(tree, 'app1').targets.build.inputs
      ).toEqual(['default', '^default', ...PNPM_INSTALL_SETTINGS_INPUTS]);
      expect(
        readNxJson(tree).targetDefaults['@nx/esbuild:esbuild'].inputs
      ).toBeUndefined();
    });

    it('writes them onto the target when the only inputs-declaring entry is filtered to another project', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        '@nx/esbuild:esbuild': [
          { cache: true },
          { filter: { projects: ['other'] }, inputs: ['production'] },
        ] as any,
      };
      updateNxJson(tree, nxJson);

      await applicationGenerator(tree, {
        directory: 'app1',
        bundler: 'esbuild',
      });

      // The filtered entry supplies some other project's array; appending
      // there would leave app1 hashing only nx's implicit default.
      expect(
        readProjectConfiguration(tree, 'app1').targets.build.inputs
      ).toEqual(['default', '^default', ...PNPM_INSTALL_SETTINGS_INPUTS]);
      const entries = readNxJson(tree).targetDefaults[
        '@nx/esbuild:esbuild'
      ] as any[];
      expect(entries[1].inputs).toEqual(['production']);
    });

    it('completes an existing entry whose json input hashes other manifest fields', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        '@nx/esbuild:esbuild': {
          inputs: [
            'default',
            { json: '{workspaceRoot}/package.json', fields: ['dependencies'] },
          ],
        },
      };
      updateNxJson(tree, nxJson);

      await applicationGenerator(tree, {
        directory: 'app1',
        bundler: 'esbuild',
      });

      expect(
        readNxJson(tree).targetDefaults['@nx/esbuild:esbuild'].inputs
      ).toEqual([
        'default',
        { json: '{workspaceRoot}/package.json', fields: ['dependencies'] },
        ...PNPM_INSTALL_SETTINGS_INPUTS,
      ]);
    });

    it('adds none of them in a non-pnpm workspace', async () => {
      (detectPackageManager as Mock).mockReturnValue('npm');
      tree.delete('pnpm-lock.yaml');

      await applicationGenerator(tree, {
        directory: 'app1',
        bundler: 'esbuild',
      });

      expect(
        readNxJson(tree).targetDefaults['@nx/esbuild:esbuild'].inputs
      ).not.toEqual(
        expect.arrayContaining(['{workspaceRoot}/pnpm-workspace.yaml'])
      );
    });
  });
});
