import { NxJsonConfiguration, readJson, Tree, getProjects } from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

// nx-ignore-next-line
import { applicationGenerator as angularApplicationGenerator } from '@nrwl/angular/generators';
import { Schema } from './schema';
import { applicationGenerator } from './application';
import { overrideCollectionResolutionForTesting } from '@nrwl/devkit/ngcli-adapter';
import { join } from 'path';

describe('app', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    overrideCollectionResolutionForTesting({
      '@nrwl/cypress': join(__dirname, '../../../../cypress/generators.json'),
      '@nrwl/jest': join(__dirname, '../../../../jest/generators.json'),
      '@nrwl/workspace': join(
        __dirname,
        '../../../../workspace/generators.json'
      ),
      '@nrwl/angular': join(__dirname, '../../../../angular/generators.json'),
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    overrideCollectionResolutionForTesting(null);
  });

  describe('not nested', () => {
    it('should update workspace.json', async () => {
      await applicationGenerator(tree, {
        name: 'myNodeApp',
        standaloneConfig: false,
      });
      const workspaceJson = readJson(tree, '/workspace.json');
      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      const project = workspaceJson.projects['my-node-app'];
      expect(project.root).toEqual('apps/my-node-app');
      expect(project.architect).toEqual(
        expect.objectContaining({
          build: {
            builder: '@nrwl/node:webpack',
            outputs: ['{options.outputPath}'],
            options: {
              outputPath: 'dist/apps/my-node-app',
              main: 'apps/my-node-app/src/main.ts',
              tsConfig: 'apps/my-node-app/tsconfig.app.json',
              assets: ['apps/my-node-app/src/assets'],
            },
            configurations: {
              production: {
                optimization: true,
                extractLicenses: true,
                inspect: false,
                fileReplacements: [
                  {
                    replace: 'apps/my-node-app/src/environments/environment.ts',
                    with: 'apps/my-node-app/src/environments/environment.prod.ts',
                  },
                ],
              },
            },
          },
          serve: {
            builder: '@nrwl/node:node',
            options: {
              buildTarget: 'my-node-app:build',
            },
          },
        })
      );
      expect(workspaceJson.projects['my-node-app'].architect.lint).toEqual({
        builder: '@nrwl/linter:eslint',
        outputs: ['{options.outputFile}'],
        options: {
          lintFilePatterns: ['apps/my-node-app/**/*.ts'],
        },
      });
      expect(workspaceJson.projects['my-node-app-e2e']).toBeUndefined();
      expect(nxJson.defaultProject).toEqual('my-node-app');
    });

    it('should update tags', async () => {
      await applicationGenerator(tree, {
        name: 'myNodeApp',
        tags: 'one,two',
        standaloneConfig: false,
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
        name: 'myNodeApp',
        standaloneConfig: false,
      });
      expect(tree.exists(`apps/my-node-app/jest.config.js`)).toBeTruthy();
      expect(tree.exists('apps/my-node-app/src/main.ts')).toBeTruthy();

      const tsconfig = readJson(tree, 'apps/my-node-app/tsconfig.json');
      expect(tsconfig).toMatchInlineSnapshot(`
        Object {
          "extends": "../../tsconfig.base.json",
          "files": Array [],
          "include": Array [],
          "references": Array [
            Object {
              "path": "./tsconfig.app.json",
            },
            Object {
              "path": "./tsconfig.spec.json",
            },
          ],
        }
      `);

      const tsconfigApp = readJson(tree, 'apps/my-node-app/tsconfig.app.json');
      expect(tsconfigApp.compilerOptions.outDir).toEqual('../../dist/out-tsc');
      expect(tsconfigApp.extends).toEqual('./tsconfig.json');
      expect(tsconfigApp.exclude).toEqual(['**/*.spec.ts', '**/*.test.ts']);
      const eslintrc = readJson(tree, 'apps/my-node-app/.eslintrc.json');
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

    it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
      tree.rename('tsconfig.base.json', 'tsconfig.json');

      await applicationGenerator(tree, {
        name: 'myNodeApp',
        standaloneConfig: false,
      });

      const tsconfig = readJson(tree, 'apps/my-node-app/tsconfig.json');
      expect(tsconfig.extends).toBe('../../tsconfig.json');
    });
  });

  describe('nested', () => {
    it('should update workspace.json', async () => {
      await applicationGenerator(tree, {
        name: 'myNodeApp',
        directory: 'myDir',
        standaloneConfig: false,
      });
      const workspaceJson = readJson(tree, '/workspace.json');
      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');

      expect(workspaceJson.projects['my-dir-my-node-app'].root).toEqual(
        'apps/my-dir/my-node-app'
      );

      expect(
        workspaceJson.projects['my-dir-my-node-app'].architect.lint
      ).toEqual({
        builder: '@nrwl/linter:eslint',
        outputs: ['{options.outputFile}'],
        options: {
          lintFilePatterns: ['apps/my-dir/my-node-app/**/*.ts'],
        },
      });

      expect(workspaceJson.projects['my-dir-my-node-app-e2e']).toBeUndefined();
      expect(nxJson.defaultProject).toEqual('my-dir-my-node-app');
    });

    it('should update tags', async () => {
      await applicationGenerator(tree, {
        name: 'myNodeApp',
        directory: 'myDir',
        tags: 'one,two',
        standaloneConfig: false,
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
        name: 'myNodeApp',
        directory: 'myDir',
        standaloneConfig: false,
      });

      // Make sure these exist
      [
        `apps/my-dir/my-node-app/jest.config.js`,
        'apps/my-dir/my-node-app/src/main.ts',
      ].forEach((path) => {
        expect(tree.exists(path)).toBeTruthy();
      });

      // Make sure these have properties
      [
        {
          path: 'apps/my-dir/my-node-app/tsconfig.app.json',
          lookupFn: (json) => json.compilerOptions.outDir,
          expectedValue: '../../../dist/out-tsc',
        },
        {
          path: 'apps/my-dir/my-node-app/tsconfig.app.json',
          lookupFn: (json) => json.compilerOptions.types,
          expectedValue: ['node'],
        },
        {
          path: 'apps/my-dir/my-node-app/tsconfig.app.json',
          lookupFn: (json) => json.exclude,
          expectedValue: ['**/*.spec.ts', '**/*.test.ts'],
        },
        {
          path: 'apps/my-dir/my-node-app/.eslintrc.json',
          lookupFn: (json) => json.extends,
          expectedValue: ['../../../.eslintrc.json'],
        },
      ].forEach(hasJsonValue);
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await applicationGenerator(tree, {
        name: 'myNodeApp',
        unitTestRunner: 'none',
        standaloneConfig: false,
      });
      expect(tree.exists('jest.config.js')).toBeFalsy();
      expect(tree.exists('apps/my-node-app/src/test-setup.ts')).toBeFalsy();
      expect(tree.exists('apps/my-node-app/src/test.ts')).toBeFalsy();
      expect(tree.exists('apps/my-node-app/tsconfig.spec.json')).toBeFalsy();
      expect(tree.exists('apps/my-node-app/jest.config.js')).toBeFalsy();
      const workspaceJson = readJson(tree, 'workspace.json');
      expect(
        workspaceJson.projects['my-node-app'].architect.test
      ).toBeUndefined();
      expect(workspaceJson.projects['my-node-app'].architect.lint)
        .toMatchInlineSnapshot(`
        Object {
          "builder": "@nrwl/linter:eslint",
          "options": Object {
            "lintFilePatterns": Array [
              "apps/my-node-app/**/*.ts",
            ],
          },
          "outputs": Array [
            "{options.outputFile}",
          ],
        }
      `);
    });
  });

  describe('--frontendProject', () => {
    it('should configure proxy', async () => {
      await angularApplicationGenerator(tree, { name: 'my-frontend' });

      await applicationGenerator(tree, {
        name: 'myNodeApp',
        frontendProject: 'my-frontend',
        standaloneConfig: false,
      });

      expect(tree.exists('apps/my-frontend/proxy.conf.json')).toBeTruthy();
      const serve = readJson(tree, 'workspace.json').projects['my-frontend']
        .architect.serve;
      expect(serve.options.proxyConfig).toEqual(
        'apps/my-frontend/proxy.conf.json'
      );
    });

    it('should configure proxies for multiple node projects with the same frontend app', async () => {
      await angularApplicationGenerator(tree, { name: 'my-frontend' });

      await applicationGenerator(tree, {
        name: 'cart',
        frontendProject: 'my-frontend',
        standaloneConfig: false,
      });

      await applicationGenerator(tree, {
        name: 'billing',
        frontendProject: 'my-frontend',
        standaloneConfig: false,
      });

      expect(tree.exists('apps/my-frontend/proxy.conf.json')).toBeTruthy();

      expect(readJson(tree, 'apps/my-frontend/proxy.conf.json')).toEqual({
        '/api': { target: 'http://localhost:3333', secure: false },
        '/billing-api': { target: 'http://localhost:3333', secure: false },
      });
    });

    it('should work with unnormalized project names', async () => {
      await angularApplicationGenerator(tree, { name: 'myFrontend' });

      await applicationGenerator(tree, {
        name: 'myNodeApp',
        frontendProject: 'myFrontend',
        standaloneConfig: false,
      });

      expect(tree.exists('apps/my-frontend/proxy.conf.json')).toBeTruthy();
      const serve = readJson(tree, 'workspace.json').projects['my-frontend']
        .architect.serve;
      expect(serve.options.proxyConfig).toEqual(
        'apps/my-frontend/proxy.conf.json'
      );
    });
  });

  describe('--babelJest', () => {
    it('should use babel for jest', async () => {
      await applicationGenerator(tree, {
        name: 'myNodeApp',
        tags: 'one,two',
        babelJest: true,
      } as Schema);

      expect(tree.read(`apps/my-node-app/jest.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "module.exports = {
          displayName: 'my-node-app',
          preset: '../../jest.preset.js',
          testEnvironment: 'node',
          transform: {
            '^.+\\\\\\\\.[tj]s$': 'babel-jest'
          },
          moduleFileExtensions: ['ts', 'js', 'html'],
          coverageDirectory: '../../coverage/apps/my-node-app'
        };
        "
      `);
    });
  });
  describe('--js flag', () => {
    it('should generate js files instead of ts files', async () => {
      await applicationGenerator(tree, {
        name: 'myNodeApp',
        js: true,
      } as Schema);

      expect(tree.exists(`apps/my-node-app/jest.config.js`)).toBeTruthy();
      expect(tree.exists('apps/my-node-app/src/main.js')).toBeTruthy();

      const tsConfig = readJson(tree, 'apps/my-node-app/tsconfig.json');
      expect(tsConfig.compilerOptions).toEqual({
        allowJs: true,
      });

      const tsConfigApp = readJson(tree, 'apps/my-node-app/tsconfig.app.json');
      expect(tsConfigApp.include).toEqual(['**/*.ts', '**/*.js']);
      expect(tsConfigApp.exclude).toEqual([
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/*.spec.js',
        '**/*.test.js',
      ]);
    });

    it('should update workspace.json', async () => {
      await applicationGenerator(tree, {
        name: 'myNodeApp',
        js: true,
      } as Schema);
      const workspaceJson = readJson(tree, '/workspace.json');
      const project = workspaceJson.projects['my-node-app'];
      const buildTarget = project.architect.build;

      expect(buildTarget.options.main).toEqual('apps/my-node-app/src/main.js');
      expect(buildTarget.configurations.production.fileReplacements).toEqual([
        {
          replace: 'apps/my-node-app/src/environments/environment.js',
          with: 'apps/my-node-app/src/environments/environment.prod.js',
        },
      ]);
    });

    it('should generate js files for nested libs as well', async () => {
      await applicationGenerator(tree, {
        name: 'myNodeApp',
        directory: 'myDir',
        js: true,
      } as Schema);
      expect(
        tree.exists(`apps/my-dir/my-node-app/jest.config.js`)
      ).toBeTruthy();
      expect(tree.exists('apps/my-dir/my-node-app/src/main.js')).toBeTruthy();
    });
  });

  describe('--pascalCaseFiles', () => {
    it(`should notify that this flag doesn't do anything`, async () => {
      await applicationGenerator(tree, {
        name: 'myNodeApp',
        pascalCaseFiles: true,
      } as Schema);

      // @TODO how to spy on context ?
      // expect(contextLoggerSpy).toHaveBeenCalledWith('NOTE: --pascalCaseFiles is a noop')
    });
  });

  describe('--skipFormat', () => {
    it('should format files by default', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await applicationGenerator(tree, { name: 'myNodeApp' });

      expect(devkit.formatFiles).toHaveBeenCalled();
    });

    it('should not format files when --skipFormat=true', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await applicationGenerator(tree, { name: 'myNodeApp', skipFormat: true });

      expect(devkit.formatFiles).not.toHaveBeenCalled();
    });
  });
});
