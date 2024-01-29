import { readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import reactInitGenerator from './init';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add react dependencies', async () => {
    await reactInitGenerator(tree, { skipFormat: true });
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['react']).toBeDefined();
    expect(packageJson.dependencies['react-dom']).toBeDefined();
    expect(packageJson.devDependencies['@nx/react']).toBeDefined();
  });
});
