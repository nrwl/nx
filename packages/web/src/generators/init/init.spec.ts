import {
  addDependenciesToPackageJson,
  NxJsonConfiguration,
  readJson,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { nxVersion } from '../../utils/versions';

import webInitGenerator from './init';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add web dependencies', async () => {
    const existing = 'existing';
    const existingVersion = '1.0.0';
    addDependenciesToPackageJson(
      tree,
      {
        '@nx/web': nxVersion,
        [existing]: existingVersion,
      },
      {
        [existing]: existingVersion,
      }
    );
    await webInitGenerator(tree, {});
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@nx/web']).toBeDefined();
    expect(packageJson.devDependencies[existing]).toBeDefined();
    expect(packageJson.dependencies['@nx/web']).toBeUndefined();
    expect(packageJson.dependencies[existing]).toBeDefined();
  });

  it('should not add jest config if unitTestRunner is none', async () => {
    await webInitGenerator(tree, {
      unitTestRunner: 'none',
    });
    expect(tree.exists('jest.config.js')).toBe(false);
  });
});
