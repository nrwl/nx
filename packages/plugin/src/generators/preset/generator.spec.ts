import '@nx/devkit/internal-testing-utils/mock-project-graph';

import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  Tree,
  readProjectConfiguration,
  readJson,
  writeJson,
} from '@nx/devkit';

import generator from './generator';
import { PackageJson } from '@nx/devkit/internal';

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
  });

  it('should use the linter it is given', async () => {
    await generator(tree, { pluginName: 'my-plugin', linter: 'oxlint' });

    expect(tree.exists('my-plugin/.oxlintrc.json')).toBe(true);
    expect(tree.exists('my-plugin/eslint.config.mjs')).toBe(false);
  });

  it('should follow the linter the workspace already uses', async () => {
    writeJson(tree, 'package.json', {
      name: '@proj/source',
      devDependencies: { oxlint: '^1.70.0' },
    });
    writeJson(tree, 'nx.json', { plugins: ['@nx/oxlint'] });

    await generator(tree, { pluginName: 'my-plugin' });

    expect(tree.exists('my-plugin/.oxlintrc.json')).toBe(true);
    expect(tree.exists('my-plugin/eslint.config.mjs')).toBe(false);
  });
});
