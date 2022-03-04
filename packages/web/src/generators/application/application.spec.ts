import type { NxJsonConfiguration, Tree } from '@nrwl/devkit';
import { getProjects, readJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { applicationGenerator } from './application';
import { Schema } from './schema';

describe('app', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('not nested', () => {
    it('should update workspace.json', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        standaloneConfig: false,
      });
      const workspaceJson = readJson(tree, '/workspace.json');
      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');

      expect(workspaceJson.projects['my-app'].root).toEqual('apps/my-app');
      expect(workspaceJson.projects['my-app-e2e'].root).toEqual(
        'apps/my-app-e2e'
      );
      expect(nxJson.defaultProject).toEqual('my-app');
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

      expect(tree.exists('apps/my-app-e2e/cypress.json')).toBeTruthy();
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

    expect(tree.read('apps/my-app/jest.config.js', 'utf-8')).not.toContain(
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
    expect(architectConfig.build.builder).toEqual('@nrwl/web:webpack');
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
    expect(architectConfig.serve.builder).toEqual('@nrwl/web:dev-server');
    expect(architectConfig.serve.options).toEqual({
      buildTarget: 'my-app:build',
    });
    expect(architectConfig.serve.configurations.production).toEqual({
      buildTarget: 'my-app:build:production',
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

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await applicationGenerator(tree, {
        name: 'myApp',
        unitTestRunner: 'none',
        standaloneConfig: false,
      });
      expect(tree.exists('jest.config.js')).toBeFalsy();
      expect(
        tree.exists('apps/my-app/src/app/app.element.spec.ts')
      ).toBeFalsy();
      expect(tree.exists('apps/my-app/tsconfig.spec.json')).toBeFalsy();
      expect(tree.exists('apps/my-app/jest.config.js')).toBeFalsy();
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

      expect(tree.read(`apps/my-app/jest.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "module.exports = {
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

      expect(tree.read(`apps/my-app/jest.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "module.exports = {
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
});
