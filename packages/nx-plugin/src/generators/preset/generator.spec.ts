import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import {
  Tree,
  readProjectConfiguration,
  readJson,
  readNxJson,
} from '@nrwl/devkit';

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
    expect(packageJson.generators).toEqual('./generators.json');
    expect(packageJson.executors).toEqual('./executors.json');
    expect(readNxJson(tree).npmScope).not.toBeDefined();
  });
});
