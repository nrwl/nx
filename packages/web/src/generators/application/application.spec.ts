import { installedCypressVersion } from '@nrwl/cypress/src/utils/cypress-version';
import {
  NxJsonConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { getProjects, readJson } from '@nrwl/devkit';
import { createTreeWithEmptyV1Workspace } from '@nrwl/devkit/testing';

import { applicationGenerator } from './application';
import { Schema } from './schema';
// need to mock cypress otherwise it'll use the nx installed version from package.json
//  which is v9 while we are testing for the new v10 version
jest.mock('@nrwl/cypress/src/utils/cypress-version');
describe('app', () => {
  let tree: Tree;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;
  beforeEach(() => {
    mockedInstalledCypressVersion.mockReturnValue(10);

    tree = createTreeWithEmptyV1Workspace();
  });

  describe('not nested', () => {
    it('should update workspace.json', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        standaloneConfig: false,
      });
      const workspaceJson = readJson(tree, '/workspace.json');
      expect(workspaceJson.projects['my-app'].root).toEqual('apps/my-app');
      expect(workspaceJson.projects['my-app-e2e'].root).toEqual(
        'apps/my-app-e2e'
      );
    });

    it('should update tags and implicit dependencies', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        tags: 'one,two',
        standaloneConfig: false,
      });
      const projects = Object.fromEntries(getProjects(tree));
      expect(projects).toMatchObject({
        'my-app': {
          tags: ['one', 'two'],
        },
        'my-app-e2e': {
          tags: [],
          implicitDependencies: ['my-app'],
        },
      });
    });

    it('should generate files', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        standaloneConfig: false,
      });
      expect(tree.exists('apps/my-app/src/main.ts')).toBeTruthy();
      expect(tree.exists('apps/my-app/src/app/app.element.ts')).toBeTruthy();
      expect(
        tree.exists('apps/my-app/src/app/app.element.spec.ts')
      ).toBeTruthy();
      expect(tree.exists('apps/my-app/src/app/app.element.css')).toBeTruthy();

      const tsconfig = readJson(tree, 'apps/my-app/tsconfig.json');
      expect(tsconfig.extends).toBe('../../tsconfig.base.json');
      expect(tsconfig.references).toEqual([
        {
          path: './tsconfig.app.json',
        },
        {
          path: './tsconfig.spec.json',
        },
      ]);

      const tsconfigApp = readJson(tree, 'apps/my-app/tsconfig.app.json');
      expect(tsconfigApp.compilerOptions.outDir).toEqual('../../dist/out-tsc');
      expect(tsconfigApp.extends).toEqual('./tsconfig.json');

      expect(tree.exists('apps/my-app-e2e/cypress.config.ts')).toBeTruthy();
      const tsconfigE2E = readJson(tree, 'apps/my-app-e2e/tsconfig.json');
      expect(tsconfigE2E).toMatchInlineSnapshot(`
        Object {
          "compilerOptions": Object {
            "allowJs": true,
            "outDir": "../../dist/out-tsc",
            "sourceMap": false,
            "types": Array [
              "cypress",
              "node",
            ],
          },
          "extends": "../../tsconfig.base.json",
          "include": Array [
            "src/**/*.ts",
            "src/**/*.js",
            "cypress.config.ts",
          ],
        }
      `);

      const eslintJson = readJson(tree, '/apps/my-app/.eslintrc.json');
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

    it('should generate files if bundler is vite', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        standaloneConfig: false,
        bundler: 'vite',
      });
      expect(tree.exists('apps/my-app/src/main.ts')).toBeTruthy();
      expect(tree.exists('apps/my-app/src/app/app.element.ts')).toBeTruthy();
      expect(
        tree.exists('apps/my-app/src/app/app.element.spec.ts')
      ).toBeTruthy();
      expect(tree.exists('apps/my-app/src/app/app.element.css')).toBeTruthy();

      const tsconfig = readJson(tree, 'apps/my-app/tsconfig.json');
      expect(tsconfig.extends).toBe('../../tsconfig.base.json');
      expect(tsconfig.references).toEqual([
        {
          path: './tsconfig.app.json',
        },
        {
          path: './tsconfig.spec.json',
        },
      ]);
      expect(tsconfig.compilerOptions.types).toMatchObject([
        'vite/client',
        'vitest',
      ]);

      expect(tree.exists('apps/my-app-e2e/cypress.config.ts')).toBeTruthy();
      expect(tree.exists('apps/my-app/index.html')).toBeTruthy();
      expect(tree.exists('apps/my-app/vite.config.ts')).toBeTruthy();
      expect(
        tree.exists(`apps/my-app/environments/environment.ts`)
      ).toBeFalsy();
      expect(
        tree.exists(`apps/my-app/environments/environment.prod.ts`)
      ).toBeFalsy();
    });

    it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
      tree.rename('tsconfig.base.json', 'tsconfig.json');

      await applicationGenerator(tree, {
        name: 'myApp',
        standaloneConfig: false,
      });

      const tsconfig = readJson(tree, 'apps/my-app/tsconfig.json');
      expect(tsconfig.extends).toBe('../../tsconfig.json');
    });
  });

  describe('nested', () => {
    it('should update workspace.json', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        directory: 'myDir',
        standaloneConfig: false,
      });
      const workspaceJson = readJson(tree, '/workspace.json');

      expect(workspaceJson.projects['my-dir-my-app'].root).toEqual(
        'apps/my-dir/my-app'
      );
      expect(workspaceJson.projects['my-dir-my-app-e2e'].root).toEqual(
        'apps/my-dir/my-app-e2e'
      );
    });

    it('should update tags and implicit dependencies', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        directory: 'myDir',
        tags: 'one,two',
        standaloneConfig: false,
      });
      const projects = Object.fromEntries(getProjects(tree));
      expect(projects).toMatchObject({
        'my-dir-my-app': {
          tags: ['one', 'two'],
        },
        'my-dir-my-app-e2e': {
          tags: [],
          implicitDependencies: ['my-dir-my-app'],
        },
      });
    });

    it('should generate files', async () => {
      const hasJsonValue = ({ path, expectedValue, lookupFn }) => {
        const config = readJson(tree, path);

        expect(lookupFn(config)).toEqual(expectedValue);
      };
      await applicationGenerator(tree, {
        name: 'myApp',
        directory: 'myDir',
        standaloneConfig: false,
      });

      // Make sure these exist
      [
        'apps/my-dir/my-app/src/main.ts',
        'apps/my-dir/my-app/src/app/app.element.ts',
        'apps/my-dir/my-app/src/app/app.element.spec.ts',
        'apps/my-dir/my-app/src/app/app.element.css',
      ].forEach((path) => {
        expect(tree.exists(path)).toBeTruthy();
      });

      // Make sure these have properties
      [
        {
          path: 'apps/my-dir/my-app/tsconfig.app.json',
          lookupFn: (json) => json.compilerOptions.outDir,
          expectedValue: '../../../dist/out-tsc',
        },
        {
          path: 'apps/my-dir/my-app-e2e/tsconfig.json',
          lookupFn: (json) => json.compilerOptions.outDir,
          expectedValue: '../../../dist/out-tsc',
        },
        {
          path: 'apps/my-dir/my-app/.eslintrc.json',
          lookupFn: (json) => json.extends,
          expectedValue: ['../../../.eslintrc.json'],
        },
      ].forEach(hasJsonValue);
    });

    it('should extend from root tsconfig.base.json', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        directory: 'myDir',
        standaloneConfig: false,
      });

      const tsconfig = readJson(tree, 'apps/my-dir/my-app/tsconfig.json');
      expect(tsconfig.extends).toBe('../../../tsconfig.base.json');
    });

    it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
      tree.rename('tsconfig.base.json', 'tsconfig.json');

      await applicationGenerator(tree, {
        name: 'myApp',
        directory: 'myDir',
        standaloneConfig: false,
      });

      const tsconfig = readJson(tree, 'apps/my-dir/my-app/tsconfig.json');
      expect(tsconfig.extends).toBe('../../../tsconfig.json');
    });

    it('should create Nx specific template', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        directory: 'myDir',
        standaloneConfig: false,
      });
      expect(
        tree.read('apps/my-dir/my-app/src/app/app.element.ts', 'utf-8')
      ).toBeTruthy();
      expect(
        tree.read('apps/my-dir/my-app/src/app/app.element.ts', 'utf-8')
      ).toContain('Hello there');
    });
  });

  describe('--style scss', () => {
    it('should generate scss styles', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        style: 'scss',
        standaloneConfig: false,
      });
      expect(tree.exists('apps/my-app/src/app/app.element.scss')).toEqual(true);
    });
  });

  it('should setup jest without serializers', async () => {
    await applicationGenerator(tree, {
      name: 'my-App',
      standaloneConfig: false,
    });

    expect(tree.read('apps/my-app/jest.config.ts', 'utf-8')).not.toContain(
      `'jest-preset-angular/build/AngularSnapshotSerializer.js',`
    );
  });

  it('should setup the nrwl web build builder', async () => {
    await applicationGenerator(tree, {
      name: 'my-App',
      standaloneConfig: false,
    });
    const workspaceJson = readJson(tree, 'workspace.json');
    const architectConfig = workspaceJson.projects['my-app'].architect;
    expect(architectConfig.build.builder).toEqual('@nrwl/webpack:webpack');
    expect(architectConfig.build.outputs).toEqual(['{options.outputPath}']);
    expect(architectConfig.build.options).toEqual({
      compiler: 'babel',
      assets: ['apps/my-app/src/favicon.ico', 'apps/my-app/src/assets'],
      index: 'apps/my-app/src/index.html',
      baseHref: '/',
      main: 'apps/my-app/src/main.ts',
      outputPath: 'dist/apps/my-app',
      polyfills: 'apps/my-app/src/polyfills.ts',
      scripts: [],
      styles: ['apps/my-app/src/styles.css'],
      tsConfig: 'apps/my-app/tsconfig.app.json',
    });
    expect(architectConfig.build.configurations.production).toEqual({
      optimization: true,
      extractLicenses: true,
      fileReplacements: [
        {
          replace: 'apps/my-app/src/environments/environment.ts',
          with: 'apps/my-app/src/environments/environment.prod.ts',
        },
      ],
      namedChunks: false,
      outputHashing: 'all',
      sourceMap: false,
      vendorChunk: false,
    });
  });

  it('should setup the nrwl web dev server builder', async () => {
    await applicationGenerator(tree, {
      name: 'my-App',
      standaloneConfig: false,
    });
    const workspaceJson = readJson(tree, 'workspace.json');
    const architectConfig = workspaceJson.projects['my-app'].architect;
    expect(architectConfig.serve.builder).toEqual('@nrwl/webpack:dev-server');
    expect(architectConfig.serve.options).toEqual({
      buildTarget: 'my-app:build',
    });
    expect(architectConfig.serve.configurations.production).toEqual({
      buildTarget: 'my-app:build:production',
    });
  });

  it('should setup the nrwl vite:build builder if bundler is vite', async () => {
    await applicationGenerator(tree, {
      name: 'my-App',
      standaloneConfig: false,
      bundler: 'vite',
    });
    const workspaceJson = readJson(tree, 'workspace.json');
    const architectConfig = workspaceJson.projects['my-app'].architect;
    expect(architectConfig.build.builder).toEqual('@nrwl/vite:build');
    expect(architectConfig.build.outputs).toEqual(['{options.outputPath}']);
    expect(architectConfig.build.options).toEqual({
      outputPath: 'dist/apps/my-app',
    });
  });

  it('should setup the nrwl vite:dev-server builder if bundler is vite', async () => {
    await applicationGenerator(tree, {
      name: 'my-App',
      standaloneConfig: false,
      bundler: 'vite',
    });
    const workspaceJson = readJson(tree, 'workspace.json');
    const architectConfig = workspaceJson.projects['my-app'].architect;
    expect(architectConfig.serve.builder).toEqual('@nrwl/vite:dev-server');
    expect(architectConfig.serve.options).toEqual({
      buildTarget: 'my-app:build',
    });
    expect(architectConfig.serve.configurations.production).toEqual({
      buildTarget: 'my-app:build:production',
      hmr: false,
    });
  });

  it('should setup the eslint builder', async () => {
    await applicationGenerator(tree, {
      name: 'my-App',
      standaloneConfig: false,
    });
    const workspaceJson = readJson(tree, 'workspace.json');

    expect(workspaceJson.projects['my-app'].architect.lint).toEqual({
      builder: '@nrwl/linter:eslint',
      outputs: ['{options.outputFile}'],
      options: {
        lintFilePatterns: ['apps/my-app/**/*.ts'],
      },
    });
  });

  describe('--prefix', () => {
    it('should use the prefix in the index.html', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        prefix: 'prefix',
        standaloneConfig: false,
      });

      expect(tree.read('apps/my-app/src/index.html', 'utf-8')).toContain(
        '<prefix-root></prefix-root>'
      );
    });
  });

  describe('--unit-test-runner', () => {
    it('--unit-test-runner=none', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        unitTestRunner: 'none',
        standaloneConfig: false,
      });
      expect(tree.exists('jest.config.ts')).toBeFalsy();
      expect(
        tree.exists('apps/my-app/src/app/app.element.spec.ts')
      ).toBeFalsy();
      expect(tree.exists('apps/my-app/tsconfig.spec.json')).toBeFalsy();
      expect(tree.exists('apps/my-app/jest.config.ts')).toBeFalsy();
      const workspaceJson = readJson(tree, 'workspace.json');
      expect(workspaceJson.projects['my-app'].architect.test).toBeUndefined();
      expect(workspaceJson.projects['my-app'].architect.lint)
        .toMatchInlineSnapshot(`
        Object {
          "builder": "@nrwl/linter:eslint",
          "options": Object {
            "lintFilePatterns": Array [
              "apps/my-app/**/*.ts",
            ],
          },
          "outputs": Array [
            "{options.outputFile}",
          ],
        }
      `);
    });

    it('--bundler=none should use jest as the default', async () => {
      await applicationGenerator(tree, {
        name: 'my-cool-app',
        standaloneConfig: false,
        bundler: 'none',
      });
      expect(tree.exists('apps/my-cool-app/jest.config.ts')).toBeTruthy();
      expect(
        readJson(tree, 'apps/my-cool-app/tsconfig.spec.json').compilerOptions
          .types
      ).toMatchInlineSnapshot(`
        Array [
          "jest",
          "node",
        ]
      `);
      expect(
        readProjectConfiguration(tree, 'my-cool-app').targets.test.executor
      ).toEqual('@nrwl/jest:jest');
    });

    it('--bundler=vite --unitTestRunner=jest', async () => {
      await applicationGenerator(tree, {
        name: 'my-vite-app',
        standaloneConfig: false,
        bundler: 'vite',
        unitTestRunner: 'jest',
      });
      expect(tree.exists('apps/my-vite-app/vite.config.ts')).toBeTruthy();
      expect(
        tree.read('apps/my-vite-app/vite.config.ts', 'utf-8')
      ).not.toContain('test: {');
      expect(tree.exists('apps/my-vite-app/jest.config.ts')).toBeTruthy();
      expect(
        readJson(tree, 'apps/my-vite-app/tsconfig.spec.json').compilerOptions
          .types
      ).toMatchInlineSnapshot(`
        Array [
          "jest",
          "node",
        ]
      `);
      expect(
        readProjectConfiguration(tree, 'my-vite-app').targets.test.executor
      ).toEqual('@nrwl/jest:jest');
    });

    it('--bundler=webpack --unitTestRunner=vitest', async () => {
      await applicationGenerator(tree, {
        name: 'my-webpack-app',
        standaloneConfig: false,
        bundler: 'webpack',
        unitTestRunner: 'vitest',
      });
      expect(tree.exists('apps/my-webpack-app/vite.config.ts')).toBeTruthy();
      expect(tree.exists('apps/my-webpack-app/jest.config.ts')).toBeFalsy();
      expect(
        readJson(tree, 'apps/my-webpack-app/tsconfig.spec.json').compilerOptions
          .types
      ).toMatchInlineSnapshot(`
        Array [
          "vitest/globals",
          "node",
        ]
      `);
      expect(
        readProjectConfiguration(tree, 'my-webpack-app').targets.test.executor
      ).toEqual('@nrwl/vite:test');
    });
  });

  describe('--e2e-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        e2eTestRunner: 'none',
        standaloneConfig: false,
      });
      expect(tree.exists('apps/my-app-e2e')).toBeFalsy();
      const workspaceJson = readJson(tree, 'workspace.json');
      expect(workspaceJson.projects['my-app-e2e']).toBeUndefined();
    });
  });

  describe('--compiler', () => {
    it('should support babel compiler', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        compiler: 'babel',
      } as Schema);

      expect(tree.read(`apps/my-app/jest.config.ts`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "/* eslint-disable */
        export default {
          displayName: 'my-app',
          preset: '../../jest.preset.js',
          setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
          transform: {
            '^.+\\\\\\\\.[tj]s$': 'babel-jest'
          },
          moduleFileExtensions: ['ts', 'js', 'html'],
          coverageDirectory: '../../coverage/apps/my-app'
        };
        "
      `);
    });

    it('should support swc compiler', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        compiler: 'swc',
      } as Schema);

      expect(tree.read(`apps/my-app/jest.config.ts`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "/* eslint-disable */
        export default {
          displayName: 'my-app',
          preset: '../../jest.preset.js',
          setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
          transform: {
            '^.+\\\\\\\\.[tj]s$': '@swc/jest'
          },
          moduleFileExtensions: ['ts', 'js', 'html'],
          coverageDirectory: '../../coverage/apps/my-app'
        };
        "
      `);
    });
  });

  describe('setup web app with --bundler=vite', () => {
    let viteAppTree: Tree;
    beforeAll(async () => {
      viteAppTree = createTreeWithEmptyV1Workspace();
      await applicationGenerator(viteAppTree, {
        name: 'myApp',
        bundler: 'vite',
      });
    });

    it('should setup targets with vite configuration', () => {
      const workspaceJson = getProjects(viteAppTree);
      const targetConfig = workspaceJson.get('my-app').targets;
      expect(targetConfig.build.executor).toEqual('@nrwl/vite:build');
      expect(targetConfig.serve.executor).toEqual('@nrwl/vite:dev-server');
      expect(targetConfig.serve.options).toEqual({
        buildTarget: 'my-app:build',
      });
    });
    it('should add dependencies in package.json', () => {
      const packageJson = readJson(viteAppTree, '/package.json');

      expect(packageJson.devDependencies).toMatchObject({
        vite: expect.any(String),
      });
    });

    it('should create correct tsconfig compilerOptions', () => {
      const tsconfigJson = readJson(viteAppTree, '/apps/my-app/tsconfig.json');
      expect(tsconfigJson.compilerOptions.types).toMatchObject([
        'vite/client',
        'vitest',
      ]);
    });

    it('should create index.html and vite.config file at the root of the app', () => {
      expect(viteAppTree.exists('/apps/my-app/index.html')).toBe(true);
      expect(viteAppTree.exists('/apps/my-app/vite.config.ts')).toBe(true);
    });

    it('should not include a spec file when the bundler or unitTestRunner is vite and insourceTests is false', async () => {
      expect(
        viteAppTree.exists('/apps/my-app/src/app/app.element.spec.ts')
      ).toBe(true);

      await applicationGenerator(viteAppTree, {
        name: 'insourceTests',
        bundler: 'vite',
        inSourceTests: true,
      });

      expect(
        viteAppTree.exists('/apps/insource-tests/src/app/app.element.spec.ts')
      ).toBe(false);
    });
  });
});
