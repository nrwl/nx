import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readJson, NxJsonConfiguration, Tree } from '@nx/devkit';

import { nextInitGenerator } from './init';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add react dependencies', async () => {
    await nextInitGenerator(tree, {});
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['@nx/react']).toBeUndefined();
    expect(packageJson.devDependencies['@nx/next']).toBeDefined();
    expect(packageJson.dependencies['next']).toBeDefined();
  });

  it('should not add jest config if unitTestRunner is none', async () => {
    await nextInitGenerator(tree, { unitTestRunner: 'none' });
    expect(tree.exists('jest.config.js')).toEqual(false);
  });
});
