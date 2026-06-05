import { readNxJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './update-plugin-path';

describe('update-plugin-path migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should do nothing when there are no plugins', () => {
    tree.write('nx.json', JSON.stringify({ namedInputs: {} }));
    update(tree);
    expect(readNxJson(tree)).toMatchInlineSnapshot(`
      {
        "namedInputs": {},
      }
    `);
  });

  it('should leave the bare @nx/dotnet plugin untouched', () => {
    tree.write('nx.json', JSON.stringify({ plugins: ['@nx/dotnet'] }));
    update(tree);
    expect(readNxJson(tree)?.plugins).toEqual(['@nx/dotnet']);
  });

  it('should rewrite the string @nx/dotnet/plugin entry to @nx/dotnet', () => {
    tree.write('nx.json', JSON.stringify({ plugins: ['@nx/dotnet/plugin'] }));
    update(tree);
    expect(readNxJson(tree)?.plugins).toEqual(['@nx/dotnet']);
  });

  it('should rewrite the object @nx/dotnet/plugin entry while preserving options', () => {
    tree.write(
      'nx.json',
      JSON.stringify({
        plugins: [
          {
            plugin: '@nx/dotnet/plugin',
            options: { build: { targetName: 'compile' } },
          },
        ],
      })
    );
    update(tree);
    expect(readNxJson(tree)?.plugins).toEqual([
      { plugin: '@nx/dotnet', options: { build: { targetName: 'compile' } } },
    ]);
  });

  it('should not create a duplicate when both the old and new paths are registered', () => {
    tree.write(
      'nx.json',
      JSON.stringify({
        plugins: ['@nx/dotnet', '@nx/dotnet/plugin'],
      })
    );
    update(tree);
    expect(readNxJson(tree)?.plugins).toEqual(['@nx/dotnet']);
  });

  it('should leave other plugins untouched', () => {
    tree.write(
      'nx.json',
      JSON.stringify({
        plugins: ['@nx/js', '@nx/dotnet/plugin', { plugin: '@nx/eslint' }],
      })
    );
    update(tree);
    expect(readNxJson(tree)?.plugins).toEqual([
      '@nx/js',
      '@nx/dotnet',
      { plugin: '@nx/eslint' },
    ]);
  });
});
