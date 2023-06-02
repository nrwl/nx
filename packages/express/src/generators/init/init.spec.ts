import {
  addDependenciesToPackageJson,
  readJson,
  NxJsonConfiguration,
  Tree,
} from '@nx/devkit';
import { expressVersion } from '../../utils/versions';
import initGenerator from './init';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add dependencies', async () => {
    const existing = 'existing';
    const existingVersion = '1.0.0';
    addDependenciesToPackageJson(
      tree,
      { '@nx/express': expressVersion, [existing]: existingVersion },
      { [existing]: existingVersion }
    );
    await initGenerator(tree, {});
    const packageJson = readJson(tree, 'package.json');
    // add express
    expect(packageJson.dependencies['express']).toBeDefined();
    // add tslib
    expect(packageJson.dependencies['tslib']).toBeDefined();
    // move `@nx/express` to dev
    expect(packageJson.dependencies['@nx/express']).toBeUndefined();
    expect(packageJson.devDependencies['@nx/express']).toBeDefined();
    // add express types
    expect(packageJson.devDependencies['@types/express']).toBeDefined();
    // keep existing packages
    expect(packageJson.devDependencies[existing]).toBeDefined();
    expect(packageJson.dependencies[existing]).toBeDefined();
  });

  it('should not add jest config if unitTestRunner is none', async () => {
    await initGenerator(tree, {
      unitTestRunner: 'none',
    });
    expect(tree.exists('jest.config.js')).toEqual(false);
  });
});
