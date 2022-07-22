import {
  addDependenciesToPackageJson,
  readJson,
  NxJsonConfiguration,
  Tree,
} from '@nrwl/devkit';
import { expressVersion } from '../../utils/versions';
import initGenerator from './init';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

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
      { '@nrwl/express': expressVersion, [existing]: existingVersion },
      { [existing]: existingVersion }
    );
    await initGenerator(tree, {});
    const packageJson = readJson(tree, 'package.json');
    // add express
    expect(packageJson.dependencies['express']).toBeDefined();
    // move `@nrwl/express` to dev
    expect(packageJson.dependencies['@nrwl/express']).toBeUndefined();
    expect(packageJson.devDependencies['@nrwl/express']).toBeDefined();
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
