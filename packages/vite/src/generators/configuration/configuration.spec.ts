import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  readJson,
  Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { nxVersion } from '../../utils/versions';

import { viteConfigurationGenerator } from './configuration';
import {
  mockAngularAppGenerator,
  mockReactAppGenerator,
  mockReactLibNonBuildableJestTestRunnerGenerator,
  mockReactLibNonBuildableVitestRunnerGenerator,
  mockUnknownAppGenerator,
  mockWebAppGenerator,
} from '../../utils/test-utils';

import { libraryGenerator as jsLibraryGenerator } from '@nx/js';
import { LibraryGeneratorSchema } from '@nx/js/internal';

describe('@nx/vite:configuration', () => {
  let tree: Tree;
  let envBackup: string | undefined;

  describe('transform React app to use Vite', () => {
    beforeAll(async () => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      mockReactAppGenerator(tree);
      const existing = 'existing';
      const existingVersion = '1.0.0';
      addDependenciesToPackageJson(
        tree,
        { '@nx/vite': nxVersion, [existing]: existingVersion },
        { [existing]: existingVersion }
      );
      await viteConfigurationGenerator(tree, {
        addPlugin: true,
        uiFramework: 'react',
        project: 'my-test-react-app',
        projectType: 'application',
      });
    });

    it('should add vite packages and react-related dependencies for vite', async () => {
      const packageJson = readJson(tree, '/package.json');
      expect(packageJson.devDependencies).toMatchObject({
        vite: expect.any(String),
        '@vitejs/plugin-react': expect.any(String),
      });
    });

    it('should move index.html to the root of the project', () => {
      expect(tree.exists('apps/my-test-react-app/src/index.html')).toBeFalsy();
      expect(tree.exists('apps/my-test-react-app/index.html')).toBeTruthy();
      expect(
        tree.read('apps/my-test-react-app/index.html', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should create correct tsconfig compilerOptions', () => {
      const tsconfigJson = readJson(
        tree,
        'apps/my-test-react-app/tsconfig.json'
      );
      expect(tsconfigJson.compilerOptions.jsx).toBe('react-jsx');
    });

    it('should create vite.config file at the root of the app', () => {
      expect(tree.exists('apps/my-test-react-app/vite.config.mts')).toBe(true);
      expect(
        tree.read('apps/my-test-react-app/vite.config.mts', 'utf-8')
      ).toMatchSnapshot();
    });
  });

  describe('transform Web app to use Vite', () => {
    beforeAll(async () => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      mockWebAppGenerator(tree);
      const existing = 'existing';
      const existingVersion = '1.0.0';
      addDependenciesToPackageJson(
        tree,
        { '@nx/vite': nxVersion, [existing]: existingVersion },
        { [existing]: existingVersion }
      );
      await viteConfigurationGenerator(tree, {
        addPlugin: true,
        uiFramework: 'none',
        project: 'my-test-web-app',
      });
    });
    it('should add vite dependencies for vite', async () => {
      const packageJson = readJson(tree, '/package.json');
      expect(packageJson.devDependencies).toMatchObject({
        vite: expect.any(String),
      });
    });

    it('should move index.html to the root of the project', () => {
      expect(tree.exists('apps/my-test-web-app/src/index.html')).toBeFalsy();
      expect(tree.exists('apps/my-test-web-app/index.html')).toBeTruthy();
      expect(
        tree.read('apps/my-test-web-app/index.html', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should create correct tsconfig compilerOptions', () => {
      const tsconfigJson = readJson(tree, 'apps/my-test-web-app/tsconfig.json');
      expect(tsconfigJson.compilerOptions.noImplicitReturns).toBeTruthy();
    });

    it('should create vite.config file at the root of the app', () => {
      expect(tree.exists('apps/my-test-web-app/vite.config.mts')).toBe(true);
      expect(
        tree.read('apps/my-test-web-app/vite.config.mts', 'utf-8')
      ).toMatchSnapshot();
    });
  });

  describe('do not transform Angular app to use Vite', () => {
    beforeAll(async () => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      mockAngularAppGenerator(tree);
    });
    it('should throw when trying to convert', async () => {
      expect.assertions(2);

      try {
        await viteConfigurationGenerator(tree, {
          addPlugin: true,
          uiFramework: 'none',
          project: 'my-test-angular-app',
        });
      } catch (e) {
        expect(e).toBeDefined();
        expect(e.toString()).toContain(
          'Nx cannot convert your project to use vite.'
        );
      }
    });
  });

  describe('inform user of unknown targets when converting', () => {
    beforeAll(async () => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      mockUnknownAppGenerator(tree);
    });

    it('should throw when trying to convert something unknown and user denies conversion', async () => {
      const { Confirm } = require('enquirer');
      const confirmSpy = jest.spyOn(Confirm.prototype, 'run');
      confirmSpy.mockResolvedValue(false);

      expect.assertions(2);

      try {
        await viteConfigurationGenerator(tree, {
          addPlugin: true,
          uiFramework: 'none',
          project: 'my-test-random-app',
        });
      } catch (e) {
        expect(e).toBeDefined();
        expect(e.toString()).toContain(
          'Nx could not verify that your project can be converted to use Vite.'
        );
      }
    });
  });

  describe('vitest', () => {
    beforeAll(async () => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      await mockReactAppGenerator(tree);
      const existing = 'existing';
      const existingVersion = '1.0.0';
      addDependenciesToPackageJson(
        tree,
        { '@nx/vite': nxVersion, [existing]: existingVersion },
        { [existing]: existingVersion }
      );
      await viteConfigurationGenerator(tree, {
        addPlugin: true,
        uiFramework: 'react',
        project: 'my-test-react-app',
        includeVitest: true,
      });
    });
    it('should create a vitest configuration if "includeVitest" is true', () => {
      const viteConfig = tree
        .read('apps/my-test-react-app/vite.config.mts')
        .toString();
      expect(viteConfig).toContain('test');
      expect(
        tree.read('apps/my-test-react-app/vite.config.mts', 'utf-8')
      ).toMatchSnapshot();
    });
  });

  describe('library mode', () => {
    beforeEach(async () => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    });

    it('should add config for building library', async () => {
      mockReactLibNonBuildableJestTestRunnerGenerator(tree);
      await viteConfigurationGenerator(tree, {
        addPlugin: true,
        uiFramework: 'react',
        includeLib: true,
        project: 'react-lib-nonb-jest',
      });
      const viteConfig = tree.read(
        'libs/react-lib-nonb-jest/vite.config.mts',
        'utf-8'
      );
      expect(viteConfig).toMatchSnapshot();
    });

    it('should set up non buildable library correctly', async () => {
      mockReactLibNonBuildableJestTestRunnerGenerator(tree);
      await viteConfigurationGenerator(tree, {
        addPlugin: true,
        uiFramework: 'react',
        project: 'react-lib-nonb-jest',
        includeVitest: true,
      });
      expect(
        tree.read('libs/react-lib-nonb-jest/vite.config.mts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should set up non buildable library which already has vite.config.mts correctly', async () => {
      const { Confirm } = require('enquirer');
      const confirmSpy = jest.spyOn(Confirm.prototype, 'run');
      confirmSpy.mockResolvedValue(true);

      mockReactLibNonBuildableVitestRunnerGenerator(tree);

      try {
        await viteConfigurationGenerator(tree, {
          addPlugin: true,
          uiFramework: 'react',
          project: 'react-lib-nonb-vitest',
          includeVitest: true,
        });
        expect(
          tree.read('libs/react-lib-nonb-vitest/vite.config.mts', 'utf-8')
        ).toMatchSnapshot();
      } catch (e) {
        throw new Error('Should not throw error');
      }
    });
  });

  describe('js library with --bundler=vite', () => {
    const defaultOptions: Omit<LibraryGeneratorSchema, 'directory'> = {
      skipTsConfig: false,
      includeBabelRc: false,
      unitTestRunner: 'jest',
      skipFormat: false,
      linter: 'eslint',
      testEnvironment: 'jsdom',
      js: false,
      strict: true,
      config: 'project',
    };

    beforeEach(() => {
      envBackup = process.env.ESLINT_USE_FLAT_CONFIG;
      delete process.env.ESLINT_USE_FLAT_CONFIG;
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    });

    afterEach(() => {
      if (envBackup === undefined) delete process.env.ESLINT_USE_FLAT_CONFIG;
      else process.env.ESLINT_USE_FLAT_CONFIG = envBackup;
    });

    it('should add build and test targets with vite and vitest', async () => {
      await jsLibraryGenerator(tree, {
        ...defaultOptions,
        directory: 'my-lib',
        bundler: 'vite',
        unitTestRunner: 'vitest',
      });

      expect(tree.exists('my-lib/vite.config.mts')).toBeTruthy();
      expect(tree.read('my-lib/vite.config.mts', 'utf-8')).toMatchSnapshot();
      expect(tree.read('my-lib/README.md', 'utf-8')).toMatchSnapshot();
      expect(tree.read('my-lib/tsconfig.lib.json', 'utf-8')).toMatchSnapshot();
      expect(tree.exists('my-lib/eslint.config.mjs')).toBeTruthy();
      expect(tree.read('my-lib/eslint.config.mjs', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import baseConfig from '../eslint.config.mjs';

        export default [
          ...baseConfig,
          {
            files: ['**/*.json'],
            rules: {
              '@nx/dependency-checks': [
                'error',
                {
                  ignoredFiles: [
                    '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
                    '{projectRoot}/vite.config.{js,ts,mjs,mts}',
                  ],
                },
              ],
            },
            languageOptions: {
              parser: await import('jsonc-eslint-parser'),
            },
          },
        ];
        "
      `);
    });

    it('should add dependency-checks rule to .eslintrc.json (eslintrc mode)', async () => {
      process.env.ESLINT_USE_FLAT_CONFIG = 'false';
      await jsLibraryGenerator(tree, {
        ...defaultOptions,
        directory: 'my-lib',
        bundler: 'vite',
        unitTestRunner: 'vitest',
      });

      expect(readJson(tree, 'my-lib/.eslintrc.json').overrides).toContainEqual({
        files: ['*.json'],
        parser: 'jsonc-eslint-parser',
        rules: {
          '@nx/dependency-checks': [
            'error',
            {
              ignoredFiles: [
                '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
                '{projectRoot}/vite.config.{js,ts,mjs,mts}',
              ],
            },
          ],
        },
      });
    });

    it.each`
      unitTestRunner | configPath
      ${'none'}      | ${undefined}
      ${'jest'}      | ${'my-lib/jest.config.cts'}
    `(
      'should respect provided unitTestRunner="$unitTestRunner"',
      async ({ unitTestRunner, configPath }) => {
        await jsLibraryGenerator(tree, {
          ...defaultOptions,
          directory: 'my-lib',
          bundler: 'vite',
          unitTestRunner,
        });

        expect(tree.read('my-lib/README.md', 'utf-8')).toMatchSnapshot();
        expect(
          tree.read('my-lib/tsconfig.lib.json', 'utf-8')
        ).toMatchSnapshot();
        if (configPath) {
          expect(tree.read(configPath, 'utf-8')).toMatchSnapshot();
        }
      }
    );
  });

  describe('TS solution setup', () => {
    beforeEach(async () => {
      tree = createTreeWithEmptyWorkspace();
      updateJson(tree, '/package.json', (json) => {
        json.workspaces = ['packages/*', 'apps/*'];
        return json;
      });
      // detectPackageManager() resolves to pnpm in the test env, so
      // isWorkspacesEnabled requires pnpm-workspace.yaml to recognise this
      // tree as using package-manager workspaces.
      tree.write(
        'pnpm-workspace.yaml',
        `packages:\n  - 'packages/*'\n  - 'apps/*'\n`
      );
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          composite: true,
          declaration: true,
          customConditions: ['@proj/source'],
        },
      });
      writeJson(tree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        files: [],
        references: [],
      });
    });

    it('should create package.json with exports field for libraries', async () => {
      addProjectConfiguration(tree, 'my-lib', {
        root: 'packages/my-lib',
      });
      writeJson(tree, 'packages/my-lib/tsconfig.lib.json', {});
      writeJson(tree, 'packages/my-lib/tsconfig.json', {});

      await viteConfigurationGenerator(tree, {
        addPlugin: true,
        uiFramework: 'none',
        project: 'my-lib',
        projectType: 'library',
        newProject: true,
      });

      expect(readJson(tree, 'packages/my-lib/package.json'))
        .toMatchInlineSnapshot(`
        {
          "exports": {
            ".": {
              "@proj/source": "./src/index.ts",
              "default": "./dist/index.js",
              "import": "./dist/index.js",
              "types": "./dist/index.d.ts",
            },
            "./package.json": "./package.json",
          },
          "main": "./dist/index.js",
          "module": "./dist/index.js",
          "name": "@proj/my-lib",
          "type": "module",
          "types": "./dist/index.d.ts",
          "version": "0.0.1",
        }
      `);
    });

    it('should not set the custom condition in exports when it does not exist in tsconfig.base.json', async () => {
      updateJson(tree, 'tsconfig.base.json', (json) => {
        delete json.compilerOptions.customConditions;
        return json;
      });
      addProjectConfiguration(tree, 'my-lib', {
        root: 'packages/my-lib',
      });
      writeJson(tree, 'packages/my-lib/tsconfig.lib.json', {});
      writeJson(tree, 'packages/my-lib/tsconfig.json', {});

      await viteConfigurationGenerator(tree, {
        addPlugin: true,
        uiFramework: 'none',
        project: 'my-lib',
        projectType: 'library',
        newProject: true,
        skipFormat: true,
      });

      expect(
        readJson(tree, 'packages/my-lib/package.json').exports['.']
      ).not.toHaveProperty('development');
    });

    it('should create package.json without exports field for apps', async () => {
      addProjectConfiguration(tree, 'my-app', {
        root: 'apps/my-app',
      });
      writeJson(tree, 'apps/my-app/tsconfig.app.json', {});
      writeJson(tree, 'apps/my-app/tsconfig.json', {});

      await viteConfigurationGenerator(tree, {
        addPlugin: true,
        uiFramework: 'none',
        project: 'my-app',
        projectType: 'application',
        newProject: true,
      });

      expect(readJson(tree, 'apps/my-app/package.json')).toMatchInlineSnapshot(`
        {
          "name": "@proj/my-app",
          "private": true,
          "version": "0.0.1",
        }
      `);
    });

    it('should generate a vite config without the deprecated helpers', async () => {
      addProjectConfiguration(tree, 'my-lib', {
        root: 'packages/my-lib',
      });
      writeJson(tree, 'packages/my-lib/tsconfig.lib.json', {});
      writeJson(tree, 'packages/my-lib/tsconfig.json', {});
      tree.write('packages/my-lib/src/index.ts', '');

      await viteConfigurationGenerator(tree, {
        addPlugin: true,
        uiFramework: 'none',
        project: 'my-lib',
        projectType: 'library',
        includeLib: true,
        newProject: false,
      });

      expect(tree.read('packages/my-lib/vite.config.mts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "/// <reference types='vitest' />
        import { defineConfig } from 'vite';
        import dts from 'vite-plugin-dts';
        import * as path from 'path';

        export default defineConfig(() => ({
          root: import.meta.dirname,
          cacheDir: '../../node_modules/.vite/packages/my-lib',
          plugins: [
            dts({
              entryRoot: 'src',
              tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
            }),
          ],
          // Uncomment this if you are using workers.
          // worker: {
          //  plugins: [],
          // },
          // Configuration for building your library.
          // See: https://vite.dev/guide/build.html#library-mode
          build: {
            outDir: './dist',
            emptyOutDir: true,
            reportCompressedSize: true,
            commonjsOptions: {
              transformMixedEsModules: true,
            },
            lib: {
              // Could also be a dictionary or array of multiple entry points.
              entry: 'src/index.ts',
              name: 'my-lib',
              fileName: 'index',
              // Change this to the formats you want to support.
              // Don't forget to update your package.json as well.
              formats: ['es' as const],
            },
            rolldownOptions: {
              // External packages that should not be bundled into your library.
              external: [],
            },
          },
        }));
        "
      `);
    });
  });

  // TODO(v24): swap to vite-tsconfig-paths in the non-ts-solution branch.
  describe('legacy non-ts-solution plugin emit', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    });

    it('should still emit the deprecated helpers for non-ts-solution libraries', async () => {
      mockReactLibNonBuildableJestTestRunnerGenerator(tree);

      await viteConfigurationGenerator(tree, {
        addPlugin: true,
        uiFramework: 'react',
        includeLib: true,
        project: 'react-lib-nonb-jest',
      });

      expect(tree.read('libs/react-lib-nonb-jest/vite.config.mts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "/// <reference types='vitest' />
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';
        import dts from 'vite-plugin-dts';
        import * as path from 'path';
        import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
        import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

        export default defineConfig(() => ({
          root: import.meta.dirname,
          cacheDir: '../../node_modules/.vite/libs/react-lib-nonb-jest',
          plugins: [
            react(),
            nxViteTsPaths(),
            nxCopyAssetsPlugin(['*.md']),
            dts({
              entryRoot: 'src',
              tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
              pathsToAliases: false,
            }),
          ],
          // Uncomment this if you are using workers.
          // worker: {
          //   plugins: () => [ nxViteTsPaths() ],
          // },
          // Configuration for building your library.
          // See: https://vite.dev/guide/build.html#library-mode
          build: {
            outDir: '../../dist/libs/react-lib-nonb-jest',
            emptyOutDir: true,
            reportCompressedSize: true,
            commonjsOptions: {
              transformMixedEsModules: true,
            },
            lib: {
              // Could also be a dictionary or array of multiple entry points.
              entry: 'src/index.ts',
              name: 'react-lib-nonb-jest',
              fileName: 'index',
              // Change this to the formats you want to support.
              // Don't forget to update your package.json as well.
              formats: ['es' as const],
            },
            rolldownOptions: {
              // External packages that should not be bundled into your library.
              external: ['react', 'react-dom', 'react/jsx-runtime'],
            },
          },
        }));
        "
      `);
    });
  });
});
