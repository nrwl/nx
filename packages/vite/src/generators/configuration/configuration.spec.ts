import 'nx/src/internal-testing-utils/mock-project-graph';

import { addDependenciesToPackageJson, readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { nxVersion } from '../../utils/versions';

import { viteConfigurationGenerator } from './configuration';
import {
  mockAngularAppGenerator,
  mockReactAppGenerator,
  mockReactLibNonBuildableJestTestRunnerGenerator,
  mockReactLibNonBuildableVitestRunnerGenerator,
  mockReactMixedAppGenerator,
  mockUnknownAppGenerator,
  mockWebAppGenerator,
} from '../../utils/test-utils';

import { libraryGenerator as jsLibraryGenerator } from '@nx/js/src/generators/library/library';
import { LibraryGeneratorSchema } from '@nx/js/src/utils/schema';

describe('@nx/vite:configuration', () => {
  let tree: Tree;

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
      expect(tree.exists('apps/my-test-react-app/vite.config.ts')).toBe(true);
      expect(
        tree.read('apps/my-test-react-app/vite.config.ts', 'utf-8')
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
      expect(tree.exists('apps/my-test-web-app/vite.config.ts')).toBe(true);
      expect(
        tree.read('apps/my-test-web-app/vite.config.ts', 'utf-8')
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
        .read('apps/my-test-react-app/vite.config.ts')
        .toString();
      expect(viteConfig).toContain('test');
      expect(
        tree.read('apps/my-test-react-app/vite.config.ts', 'utf-8')
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
        'libs/react-lib-nonb-jest/vite.config.ts',
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
        tree.read('libs/react-lib-nonb-jest/vite.config.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should set up non buildable library which already has vite.config.ts correctly', async () => {
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
          tree.read('libs/react-lib-nonb-vitest/vite.config.ts', 'utf-8')
        ).toMatchSnapshot();
      } catch (e) {
        throw new Error('Should not throw error');
      }
    });
  });

  describe('js library with --bundler=vite', () => {
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
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    });

    it('should add build and test targets with vite and vitest', async () => {
      await jsLibraryGenerator(tree, {
        ...defaultOptions,
        name: 'my-lib',
        bundler: 'vite',
        unitTestRunner: undefined,
        projectNameAndRootFormat: 'as-provided',
      });

      expect(tree.exists('my-lib/vite.config.ts')).toBeTruthy();
      expect(tree.read('my-lib/vite.config.ts', 'utf-8')).toMatchSnapshot();
      expect(tree.read('my-lib/README.md', 'utf-8')).toMatchSnapshot();
      expect(tree.read('my-lib/tsconfig.lib.json', 'utf-8')).toMatchSnapshot();
      expect(readJson(tree, 'my-lib/.eslintrc.json').overrides).toContainEqual({
        files: ['*.json'],
        parser: 'jsonc-eslint-parser',
        rules: {
          '@nx/dependency-checks': [
            'error',
            {
              ignoredFiles: ['{projectRoot}/vite.config.{js,ts,mjs,mts}'],
            },
          ],
        },
      });
    });

    it.each`
      unitTestRunner | configPath
      ${'none'}      | ${undefined}
      ${'jest'}      | ${'my-lib/jest.config.ts'}
    `(
      'should respect unitTestRunner if passed',
      async ({ unitTestRunner, configPath }) => {
        await jsLibraryGenerator(tree, {
          ...defaultOptions,
          name: 'my-lib',
          bundler: 'vite',
          unitTestRunner,
          projectNameAndRootFormat: 'as-provided',
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
});
