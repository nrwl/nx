import {
  addDependenciesToPackageJson,
  NxJsonConfiguration,
  readJson,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { nxVersion } from '../../utils/versions';

import { initGenerator } from './init';

describe('@nx/vite:init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  describe('dependencies for package.json', () => {
    it('should add vite packages and react-related dependencies for vite', async () => {
      const existing = 'existing';
      const existingVersion = '1.0.0';
      addDependenciesToPackageJson(
        tree,
        { '@nx/vite': nxVersion, [existing]: existingVersion },
        { [existing]: existingVersion }
      );
      await initGenerator(tree, {
        uiFramework: 'react',
      });
      const packageJson = readJson(tree, 'package.json');

      expect(packageJson).toMatchSnapshot();
    });

    it('should support --testEnvironment=jsdom', async () => {
      await initGenerator(tree, {
        testEnvironment: 'jsdom',
        uiFramework: 'none',
      });

      const packageJson = readJson(tree, 'package.json');

      expect(packageJson).toMatchSnapshot();
    });

    it('should support --testEnvironment=happy-dom', async () => {
      await initGenerator(tree, {
        testEnvironment: 'happy-dom',
        uiFramework: 'none',
      });

      const packageJson = readJson(tree, 'package.json');

      expect(packageJson).toMatchSnapshot();
    });

    it('should support --testEnvironment=edge-runtime', async () => {
      await initGenerator(tree, {
        testEnvironment: 'edge-runtime',
        uiFramework: 'none',
      });

      const packageJson = readJson(tree, 'package.json');

      expect(packageJson).toMatchSnapshot();
    });
  });

  describe('vitest targets', () => {
    it('should add target defaults for test', async () => {
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.namedInputs ??= {};
        json.namedInputs.production = ['default'];
        return json;
      });

      await initGenerator(tree, { uiFramework: 'react' });

      const productionNamedInputs = readJson(tree, 'nx.json').namedInputs
        .production;
      const testDefaults = readJson(tree, 'nx.json').targetDefaults.test;

      expect(productionNamedInputs).toContain(
        '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)'
      );
      expect(productionNamedInputs).toContain(
        '!{projectRoot}/tsconfig.spec.json'
      );
      expect(testDefaults).toEqual({
        inputs: ['default', '^production'],
      });
    });
  });
});
