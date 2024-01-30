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
    it('should add required packages', async () => {
      const existing = 'existing';
      const existingVersion = '1.0.0';
      addDependenciesToPackageJson(
        tree,
        { '@nx/vite': nxVersion, [existing]: existingVersion },
        { [existing]: existingVersion }
      );
      await initGenerator(tree, {});
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

      await initGenerator(tree, {});

      const productionNamedInputs = readJson(tree, 'nx.json').namedInputs
        .production;
      const vitestDefaults = readJson(tree, 'nx.json').targetDefaults[
        '@nx/vite:test'
      ];

      expect(productionNamedInputs).toContain(
        '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)'
      );
      expect(productionNamedInputs).toContain(
        '!{projectRoot}/tsconfig.spec.json'
      );
      expect(vitestDefaults).toEqual({
        cache: true,
        inputs: ['default', '^production'],
      });
    });
  });
});
