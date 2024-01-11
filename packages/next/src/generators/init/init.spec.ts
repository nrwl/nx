import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readJson, NxJsonConfiguration, Tree } from '@nx/devkit';

import { nextInitGenerator } from './init';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add react dependencies', async () => {
    await nextInitGenerator(tree, {});
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['@nx/react']).toBeUndefined();
    expect(packageJson.devDependencies['@nx/next']).toBeDefined();
    expect(packageJson.dependencies['next']).toBeDefined();
  });
});
