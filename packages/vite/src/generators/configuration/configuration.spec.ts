import { addDependenciesToPackageJson, readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyV1Workspace } from '@nrwl/devkit/testing';
import { nxVersion } from '../../utils/versions';

import { viteConfigurationGenerator } from './configuration';
import {
  mockReactAppGenerator,
  mockWebAppGenerator,
} from '../../utils/test-utils';

describe('@nrwl/vite:configuration', () => {
  let tree: Tree;

  describe('transform React app to use Vite', () => {
    beforeAll(async () => {
      tree = createTreeWithEmptyV1Workspace();
      await mockReactAppGenerator(tree);
      const existing = 'existing';
      const existingVersion = '1.0.0';
      addDependenciesToPackageJson(
        tree,
        { '@nrwl/vite': nxVersion, [existing]: existingVersion },
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
    });
  });

  describe('transform Web app to use Vite', () => {
    beforeAll(async () => {
      tree = createTreeWithEmptyV1Workspace();
      await mockWebAppGenerator(tree);
      const existing = 'existing';
      const existingVersion = '1.0.0';
      addDependenciesToPackageJson(
        tree,
        { '@nrwl/vite': nxVersion, [existing]: existingVersion },
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
    });

    it('should create correct tsconfig compilerOptions', () => {
      const tsconfigJson = readJson(tree, 'apps/my-test-web-app/tsconfig.json');
      expect(tsconfigJson.compilerOptions.types).toMatchObject(['vite/client']);
    });

    it('should create vite.config file at the root of the app', () => {
      expect(tree.exists('apps/my-test-web-app/vite.config.ts')).toBe(true);
    });
  });

  describe('vitest', () => {
    beforeAll(async () => {
      tree = createTreeWithEmptyV1Workspace();
      await mockReactAppGenerator(tree);
      const existing = 'existing';
      const existingVersion = '1.0.0';
      addDependenciesToPackageJson(
        tree,
        { '@nrwl/vite': nxVersion, [existing]: existingVersion },
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
      console.log(viteConfig);
      expect(viteConfig).toContain('test');
    });
  });
});
