import { readJson, writeJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addPluginsToOxlintConfig } from './oxlint-config';

describe('addPluginsToOxlintConfig', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    writeJson(tree, '.oxlintrc.json', { plugins: ['typescript'], rules: {} });
  });

  it('should scope plugins to the project root', () => {
    addPluginsToOxlintConfig(tree, 'apps/my-app', ['react', 'jsx-a11y']);

    expect(readJson(tree, '.oxlintrc.json').overrides).toEqual([
      { files: ['apps/my-app/**/*'], plugins: ['react', 'jsx-a11y'] },
    ]);
  });

  it('should leave the top-level plugins untouched', () => {
    addPluginsToOxlintConfig(tree, 'apps/my-app', ['react']);

    expect(readJson(tree, '.oxlintrc.json').plugins).toEqual(['typescript']);
  });

  it('should merge into an existing override for the same root', () => {
    addPluginsToOxlintConfig(tree, 'apps/my-app', ['react']);
    addPluginsToOxlintConfig(tree, 'apps/my-app', ['react', 'react-perf']);

    expect(readJson(tree, '.oxlintrc.json').overrides).toEqual([
      { files: ['apps/my-app/**/*'], plugins: ['react', 'react-perf'] },
    ]);
  });

  it('should keep separate overrides for separate projects', () => {
    addPluginsToOxlintConfig(tree, 'apps/react-app', ['react']);
    addPluginsToOxlintConfig(tree, 'apps/vue-app', ['vue']);

    expect(readJson(tree, '.oxlintrc.json').overrides).toEqual([
      { files: ['apps/react-app/**/*'], plugins: ['react'] },
      { files: ['apps/vue-app/**/*'], plugins: ['vue'] },
    ]);
  });

  it('should use a bare glob for a root project', () => {
    addPluginsToOxlintConfig(tree, '.', ['react']);

    expect(readJson(tree, '.oxlintrc.json').overrides).toEqual([
      { files: ['**/*'], plugins: ['react'] },
    ]);
  });

  it('should no-op without plugins', () => {
    addPluginsToOxlintConfig(tree, 'apps/my-app', []);

    expect(readJson(tree, '.oxlintrc.json').overrides).toBeUndefined();
  });

  it('should no-op when the workspace uses a TypeScript config', () => {
    tree.delete('.oxlintrc.json');
    tree.write('oxlint.config.ts', 'export default {};');

    expect(() =>
      addPluginsToOxlintConfig(tree, 'apps/my-app', ['react'])
    ).not.toThrow();
    expect(tree.exists('.oxlintrc.json')).toBe(false);
  });
});
