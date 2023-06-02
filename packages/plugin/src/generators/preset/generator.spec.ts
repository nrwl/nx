import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readProjectConfiguration, readJson } from '@nx/devkit';

import generator from './generator';
import { PackageJson } from 'nx/src/utils/package-json';

describe('preset generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should create a plugin', async () => {
    await generator(tree, {
      pluginName: 'my-plugin',
    });
    const config = readProjectConfiguration(tree, 'my-plugin');
    expect(config).toBeDefined();
    const packageJson = readJson<PackageJson>(tree, 'package.json');
    expect(packageJson.dependencies).toHaveProperty('@nx/devkit');
    expect(readJson(tree, 'nx.json').npmScope).not.toBeDefined();
  });
});
