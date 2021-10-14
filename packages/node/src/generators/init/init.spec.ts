import {
  addDependenciesToPackageJson,
  NxJsonConfiguration,
  readJson,
  Tree,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { nxVersion } from '../../utils/versions';
import { initGenerator } from './init';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add dependencies', async () => {
    const existing = 'existing';
    const existingVersion = '1.0.0';

    addDependenciesToPackageJson(
      tree,
      {
        '@nrwl/node': nxVersion,
        [existing]: existingVersion,
      },
      {
        [existing]: existingVersion,
      }
    );
    await initGenerator(tree, {});

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['@nrwl/node']).toBeUndefined();
    expect(packageJson.dependencies['tslib']).toBeDefined();
    expect(packageJson.dependencies[existing]).toBeDefined();
    expect(packageJson.devDependencies['@nrwl/node']).toBeDefined();
    expect(packageJson.devDependencies[existing]).toBeDefined();
  });

  describe('defaultCollection', () => {
    it('should be set if none was set before', async () => {
      await initGenerator(tree, {});
      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(nxJson.cli.defaultCollection).toEqual('@nrwl/node');
    });
  });

  it('should not add jest config if unitTestRunner is none', async () => {
    await initGenerator(tree, { unitTestRunner: 'none' });
    expect(tree.exists('jest.config.js')).toEqual(false);
  });
});
