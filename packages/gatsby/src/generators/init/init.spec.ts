import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { NxJsonConfiguration, readJson, Tree } from '@nrwl/devkit';

import { gatsbyInitGenerator } from './init';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add react dependencies', async () => {
    await gatsbyInitGenerator(tree, {});
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['@nrwl/gatsby']).toBeUndefined();
    expect(packageJson.dependencies['@nrwl/react']).toBeUndefined();
    expect(packageJson.dependencies['gatsby']).toBeDefined();
  });

  describe('defaultCollection', () => {
    it('should be set if none was set before', async () => {
      await gatsbyInitGenerator(tree, {});
      const { cli } = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(cli.defaultCollection).toEqual('@nrwl/gatsby');
    });
  });

  it('should not add jest config if unitTestRunner is none', async () => {
    await gatsbyInitGenerator(tree, { unitTestRunner: 'none' });
    expect(tree.exists('jest.config.js')).toEqual(false);
  });
});
