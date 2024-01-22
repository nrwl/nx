import {
  addDependenciesToPackageJson,
  readJson,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

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
        '@nx/node': nxVersion,
        [existing]: existingVersion,
      },
      {
        [existing]: existingVersion,
      }
    );
    await initGenerator(tree, {});

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['@nx/node']).toBeUndefined();
    expect(packageJson.dependencies[existing]).toBeDefined();
    expect(packageJson.devDependencies['@nx/node']).toBeDefined();
    expect(packageJson.devDependencies[existing]).toBeDefined();
  });

  it('should not fail when dependencies is missing from package.json and no other init generators are invoked', async () => {
    updateJson(tree, 'package.json', (json) => {
      delete json.dependencies;
      return json;
    });

    await expect(initGenerator(tree, {})).resolves.toBeTruthy();
  });
});
