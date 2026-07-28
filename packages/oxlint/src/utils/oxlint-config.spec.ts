import { readJson, writeJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addPluginsToOxlintConfig } from './oxlint-config';

describe('addPluginsToOxlintConfig', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    writeJson(tree, '.oxlintrc.json', { plugins: ['typescript'], rules: {} });
  });

  it('should write the plugins to the project config', () => {
    addPluginsToOxlintConfig(tree, 'apps/my-app', ['react', 'jsx-a11y']);

    expect(readJson(tree, 'apps/my-app/.oxlintrc.json')).toEqual({
      extends: ['../../.oxlintrc.json'],
      plugins: ['react', 'jsx-a11y'],
    });
  });

  it('should extend the root config, since a nested config replaces it', () => {
    addPluginsToOxlintConfig(tree, 'apps/nested/deep/my-app', ['react']);

    expect(
      readJson(tree, 'apps/nested/deep/my-app/.oxlintrc.json').extends
    ).toEqual(['../../../../.oxlintrc.json']);
  });

  it('should leave the root config untouched', () => {
    addPluginsToOxlintConfig(tree, 'apps/my-app', ['react']);

    expect(readJson(tree, '.oxlintrc.json')).toEqual({
      plugins: ['typescript'],
      rules: {},
    });
  });

  it('should merge into an existing project config', () => {
    addPluginsToOxlintConfig(tree, 'apps/my-app', ['react']);
    addPluginsToOxlintConfig(tree, 'apps/my-app', ['react', 'react-perf']);

    expect(readJson(tree, 'apps/my-app/.oxlintrc.json')).toEqual({
      extends: ['../../.oxlintrc.json'],
      plugins: ['react', 'react-perf'],
    });
  });

  it('should keep each project independent', () => {
    addPluginsToOxlintConfig(tree, 'apps/react-app', ['react']);
    addPluginsToOxlintConfig(tree, 'apps/vue-app', ['vue']);

    expect(readJson(tree, 'apps/react-app/.oxlintrc.json').plugins).toEqual([
      'react',
    ]);
    expect(readJson(tree, 'apps/vue-app/.oxlintrc.json').plugins).toEqual([
      'vue',
    ]);
  });

  it('should add to the root config itself for a root project', () => {
    addPluginsToOxlintConfig(tree, '.', ['react']);

    expect(readJson(tree, '.oxlintrc.json')).toEqual({
      plugins: ['typescript', 'react'],
      rules: {},
    });
  });

  it('should no-op without plugins', () => {
    addPluginsToOxlintConfig(tree, 'apps/my-app', []);

    expect(tree.exists('apps/my-app/.oxlintrc.json')).toBe(false);
  });

  it('should no-op when the workspace uses a TypeScript config', () => {
    tree.delete('.oxlintrc.json');
    tree.write('oxlint.config.ts', 'export default {};');

    addPluginsToOxlintConfig(tree, 'apps/my-app', ['react']);

    expect(tree.exists('apps/my-app/.oxlintrc.json')).toBe(false);
  });
});
