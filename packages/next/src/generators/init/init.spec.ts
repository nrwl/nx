import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { readJson, readNxJson, Tree } from '@nrwl/devkit';

import { nextInitGenerator } from './init';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add react dependencies', async () => {
    await nextInitGenerator(tree, {});
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['@nrwl/react']).toBeUndefined();
    expect(packageJson.dependencies['@nrwl/next']).toBeDefined();
    expect(packageJson.dependencies['next']).toBeDefined();
  });

  describe('defaultCollection', () => {
    it('should be set if none was set before', async () => {
      await nextInitGenerator(tree, {});
      const { cli } = readNxJson(tree);
      expect(cli.defaultCollection).toEqual('@nrwl/next');
    });
  });

  it('should not add jest config if unitTestRunner is none', async () => {
    await nextInitGenerator(tree, { unitTestRunner: 'none' });
    expect(tree.exists('jest.config.js')).toEqual(false);
  });
});
