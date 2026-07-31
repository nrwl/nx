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

  // The root's format only matters when a project config has to be created,
  // because that is what needs an `extends` pointing at the root.
  it('should still update a project config that already exists under a TypeScript root', () => {
    tree.delete('.oxlintrc.json');
    tree.write('oxlint.config.ts', 'export default {};');
    writeJson(tree, 'apps/my-app/.oxlintrc.json', { plugins: ['vue'] });

    addPluginsToOxlintConfig(tree, 'apps/my-app', ['react']);

    expect(readJson(tree, 'apps/my-app/.oxlintrc.json').plugins).toEqual([
      'vue',
      'react',
    ]);
  });

  it('should not write a second config beside an existing .oxlintrc.jsonc', () => {
    tree.write(
      'apps/my-app/.oxlintrc.jsonc',
      '{\n  // keep this\n  "plugins": ["vue"]\n}\n'
    );

    addPluginsToOxlintConfig(tree, 'apps/my-app', ['react']);

    // Two configs in one directory is a hard error in Oxlint, not an override.
    expect(tree.exists('apps/my-app/.oxlintrc.json')).toBe(false);
  });

  it('should keep comments in an existing .oxlintrc.jsonc', () => {
    tree.write(
      'apps/my-app/.oxlintrc.jsonc',
      '{\n  // keep this\n  "plugins": ["vue"]\n}\n'
    );

    addPluginsToOxlintConfig(tree, 'apps/my-app', ['react']);

    // `updateJson` parses comments away and re-serializes, which would silently
    // discard the one thing the .jsonc format exists for.
    expect(tree.read('apps/my-app/.oxlintrc.jsonc', 'utf-8')).toContain(
      '// keep this'
    );
  });
});
