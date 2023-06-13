import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  readJson,
  Tree,
} from '@nx/devkit';
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
      expect(tsconfigJson.compilerOptions.types).toMatchObject(['vite/client']);
    });

    it('should create vite.config file at the root of the app', () => {
      expect(tree.exists('apps/my-test-react-app/vite.config.ts')).toBe(true);
      expect(
        tree.read('apps/my-test-react-app/vite.config.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should transform workspace.json project config', () => {
      expect(tree.read('workspace.json', 'utf-8')).toMatchSnapshot();
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
        uiFramework: 'none',
        project: 'my-test-web-app',
      });
    });
    it('should add vite dependencies for vite', async () => {
      const packageJson = readJson(tree, '/package.json');
      expect(packageJson.devDependencies).toMatchObject({
        vite: expect.any(String),
        'vite-tsconfig-paths': expect.any(String),
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
      expect(tsconfigJson.compilerOptions.types).toMatchObject(['vite/client']);
    });

    it('should create vite.config file at the root of the app', () => {
      expect(tree.exists('apps/my-test-web-app/vite.config.ts')).toBe(true);
      expect(
        tree.read('apps/my-test-web-app/vite.config.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should transform workspace.json project config', () => {
      expect(tree.read('workspace.json', 'utf-8')).toMatchSnapshot();
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
          uiFramework: 'none',
          project: 'my-test-angular-app',
        });
      } catch (e) {
        expect(e).toBeDefined();
        expect(e.toString()).toContain(
          'The project my-test-angular-app cannot be converted to use the @nx/vite executors'
        );
      }
    });
  });

  describe('inform user of unknown targets when converting', () => {
    beforeAll(async () => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      mockUnknownAppGenerator(tree);
    });

    it('should throw when trying to convert something unknown', async () => {
      const { Confirm } = require('enquirer');
      const confirmSpy = jest.spyOn(Confirm.prototype, 'run');
      confirmSpy.mockResolvedValue(true);
      expect.assertions(2);

      try {
        await viteConfigurationGenerator(tree, {
          uiFramework: 'none',
          project: 'my-test-random-app',
        });
      } catch (e) {
        expect(e).toBeDefined();
        expect(e.toString()).toContain(
          'Error: Cannot find apps/my-test-random-app/tsconfig.json'
        );
      }
    });

    it('should throw when trying to convert something unknown and user denies conversion', async () => {
      const { Confirm } = require('enquirer');
      const confirmSpy = jest.spyOn(Confirm.prototype, 'run');
      confirmSpy.mockResolvedValue(false);

      expect.assertions(2);

      try {
        await viteConfigurationGenerator(tree, {
          uiFramework: 'none',
          project: 'my-test-random-app',
        });
      } catch (e) {
        expect(e).toBeDefined();
        expect(e.toString()).toContain(
          'Nx could not verify that the executors you are using can be converted to the @nx/vite executors.'
        );
      }
    });
  });

  describe('transform React app to use Vite by providing custom targets', () => {
    describe('transform React app if supported executor is provided', () => {
      beforeEach(async () => {
        tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
        mockReactMixedAppGenerator(tree);
        const existing = 'existing';
        const existingVersion = '1.0.0';
        addDependenciesToPackageJson(
          tree,
          { '@nx/vite': nxVersion, [existing]: existingVersion },
          { [existing]: existingVersion }
        );
        await viteConfigurationGenerator(tree, {
          uiFramework: 'react',
          project: 'my-test-mixed-react-app',
          buildTarget: 'valid-build',
        });
      });
      it('should add vite packages and react-related dependencies for vite', async () => {
        const packageJson = readJson(tree, '/package.json');
        expect(packageJson.devDependencies).toMatchObject({
          vite: expect.any(String),
          '@vitejs/plugin-react': expect.any(String),
        });
      });

      it('should create vite.config file at the root of the app', () => {
        expect(tree.exists('apps/my-test-mixed-react-app/vite.config.ts')).toBe(
          true
        );
      });

      it('should transform workspace.json project config', () => {
        expect(tree.read('workspace.json', 'utf-8')).toMatchSnapshot();
      });
    });

    describe('do NOT transform React app if unsupported executor is provided', () => {
      beforeEach(async () => {
        tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
        mockReactMixedAppGenerator(tree);
        const existing = 'existing';
        const existingVersion = '1.0.0';
        addDependenciesToPackageJson(
          tree,
          { '@nx/vite': nxVersion, [existing]: existingVersion },
          { [existing]: existingVersion }
        );
      });
      it('should throw when trying to convert and user denies', async () => {
        const { Confirm } = require('enquirer');
        const confirmSpy = jest.spyOn(Confirm.prototype, 'run');
        confirmSpy.mockResolvedValue(false);
        expect.assertions(2);

        try {
          await viteConfigurationGenerator(tree, {
            uiFramework: 'none',
            project: 'my-test-mixed-react-app',
            buildTarget: 'invalid-build',
          });
        } catch (e) {
          expect(e).toBeDefined();
          expect(e.toString()).toContain(
            'The build target invalid-build cannot be converted to use the @nx/vite:build executor'
          );
        }
      });

      it('should NOT throw error when trying to convert and user confirms', async () => {
        const { Confirm } = require('enquirer');
        const confirmSpy = jest.spyOn(Confirm.prototype, 'run');
        confirmSpy.mockResolvedValue(true);
        expect.assertions(1);

        try {
          await viteConfigurationGenerator(tree, {
            uiFramework: 'none',
            project: 'my-test-mixed-react-app',
            buildTarget: 'invalid-build',
          });
          expect(
            tree.exists('apps/my-test-mixed-react-app/vite.config.ts')
          ).toBe(true);
        } catch (e) {
          throw new Error('Should not throw error');
        }
      });
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
      addProjectConfiguration(tree, 'my-lib', {
        root: 'my-lib',
      });
      await viteConfigurationGenerator(tree, {
        uiFramework: 'react',
        includeLib: true,
        project: 'my-lib',
        newProject: true,
      });

      const viteConfig = tree.read('my-lib/vite.config.ts').toString();

      expect(viteConfig).toMatch('build: {');
      expect(viteConfig).toMatch("external: ['react'");
      expect(tree.read('my-lib/vite.config.ts', 'utf-8')).toMatchSnapshot();
    });

    it('should set up non buildable library correctly', async () => {
      mockReactLibNonBuildableJestTestRunnerGenerator(tree);
      await viteConfigurationGenerator(tree, {
        uiFramework: 'react',
        project: 'react-lib-nonb-jest',
        includeVitest: true,
      });
      expect(
        tree.read('libs/react-lib-nonb-jest/vite.config.ts', 'utf-8')
      ).toMatchSnapshot();

      expect(tree.read('workspace.json', 'utf-8')).toMatchSnapshot();
    });

    it('should set up non buildable library which already has vite.config.ts correctly', async () => {
      const { Confirm } = require('enquirer');
      const confirmSpy = jest.spyOn(Confirm.prototype, 'run');
      confirmSpy.mockResolvedValue(true);
      expect.assertions(2);

      mockReactLibNonBuildableVitestRunnerGenerator(tree);

      try {
        await viteConfigurationGenerator(tree, {
          uiFramework: 'react',
          project: 'react-lib-nonb-vitest',
          includeVitest: true,
        });
        expect(
          tree.read('libs/react-lib-nonb-vitest/vite.config.ts', 'utf-8')
        ).toMatchSnapshot();

        expect(tree.read('workspace.json', 'utf-8')).toMatchSnapshot();
      } catch (e) {
        throw new Error('Should not throw error');
      }
    });
  });
});
