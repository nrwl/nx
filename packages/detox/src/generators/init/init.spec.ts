import { Tree, readJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { detoxInitGenerator } from './init';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add detox dependencies', async () => {
    await detoxInitGenerator(tree, {});
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@nrwl/detox']).toBeDefined();
    expect(packageJson.devDependencies['@types/detox']).toBeDefined();
    expect(packageJson.devDependencies['detox']).toBeDefined();
  });
});
