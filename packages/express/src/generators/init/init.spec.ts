import { addDependenciesToPackageJson, readJson, Tree } from '@nx/devkit';
import { expressVersion } from '../../utils/versions';
import initGenerator from './init';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

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
      { '@nx/express': expressVersion, [existing]: existingVersion },
      { [existing]: existingVersion }
    );
    await initGenerator(tree, {});
    const packageJson = readJson(tree, 'package.json');
    // add express
    expect(packageJson.dependencies['express']).toBeDefined();
    // move `@nx/express` to dev
    expect(packageJson.dependencies['@nx/express']).toBeUndefined();
    expect(packageJson.devDependencies['@nx/express']).toBeDefined();
    // keep existing packages
    expect(packageJson.devDependencies[existing]).toBeDefined();
    expect(packageJson.dependencies[existing]).toBeDefined();
  });
});
