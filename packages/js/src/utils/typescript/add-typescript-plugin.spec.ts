import '@nx/devkit/internal-testing-utils/mock-project-graph';

import {
  readNxJson,
  type Tree,
  updateJson,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  ensureTypescriptPluginForTsSolution,
  registerTypescriptPluginForTypecheck,
} from './add-typescript-plugin';

describe('ensureTypescriptPluginForTsSolution', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function setUpTsSolution() {
    updateJson(tree, 'package.json', (json) => {
      json.workspaces = ['packages/*'];
      return json;
    });
    tree.write('pnpm-workspace.yaml', `packages:\n  - 'packages/*'\n`);
    writeJson(tree, 'tsconfig.base.json', {
      compilerOptions: { composite: true, declaration: true },
    });
    writeJson(tree, 'tsconfig.json', {
      extends: './tsconfig.base.json',
      files: [],
      references: [],
    });
  }

  function typescriptRegistrations() {
    return (readNxJson(tree).plugins ?? []).filter((p) =>
      typeof p === 'string'
        ? p === '@nx/js/typescript'
        : p.plugin === '@nx/js/typescript'
    );
  }

  it('should register @nx/js/typescript in a TS solution setup', async () => {
    setUpTsSolution();

    await ensureTypescriptPluginForTsSolution(tree);

    expect(typescriptRegistrations()).toEqual([
      {
        plugin: '@nx/js/typescript',
        options: {
          typecheck: { targetName: 'typecheck' },
          build: {
            targetName: 'build',
            configName: 'tsconfig.lib.json',
            buildDepsName: 'build-deps',
            watchDepsName: 'watch-deps',
          },
        },
      },
    ]);
  });

  it('should not touch an existing registration, including a scoped one', async () => {
    setUpTsSolution();
    const nxJson = readNxJson(tree);
    nxJson.plugins = [
      { plugin: '@nx/js/typescript', include: ['packages/a/*'] },
    ];
    updateNxJson(tree, nxJson);

    await ensureTypescriptPluginForTsSolution(tree);

    expect(typescriptRegistrations()).toEqual([
      { plugin: '@nx/js/typescript', include: ['packages/a/*'] },
    ]);
  });

  it('should do nothing outside a TS solution setup', async () => {
    await ensureTypescriptPluginForTsSolution(tree);

    expect(typescriptRegistrations()).toEqual([]);
  });
});

describe('registerTypescriptPluginForTypecheck', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => {
      json.workspaces = ['packages/*'];
      return json;
    });
    writeJson(tree, 'tsconfig.base.json', {
      compilerOptions: { composite: true },
    });
    writeJson(tree, 'tsconfig.json', {
      extends: './tsconfig.base.json',
      files: [],
      references: [],
    });
  });

  function setPlugins(plugins: any[]) {
    const nxJson = readNxJson(tree);
    nxJson.plugins = plugins;
    updateNxJson(tree, nxJson);
  }

  it('should register @nx/js/typescript with only its typecheck target', () => {
    setPlugins(['@nx/vite/plugin']);

    expect(registerTypescriptPluginForTypecheck(tree, '@nx/vite/plugin')).toBe(
      true
    );
    expect(readNxJson(tree).plugins).toEqual([
      '@nx/vite/plugin',
      {
        plugin: '@nx/js/typescript',
        options: { typecheck: { targetName: 'typecheck' } },
      },
    ]);
  });

  it("should reuse the framework plugin's typecheck target name", () => {
    setPlugins([
      {
        plugin: '@nx/remix/plugin',
        options: { typecheckTargetName: 'remix:typecheck' },
      },
    ]);

    registerTypescriptPluginForTypecheck(tree, '@nx/remix/plugin');

    expect(readNxJson(tree).plugins[1]).toEqual({
      plugin: '@nx/js/typescript',
      options: { typecheck: { targetName: 'remix:typecheck' } },
    });
  });

  it('should skip a framework plugin that opted out of typecheck', () => {
    setPlugins([
      { plugin: '@nx/rsbuild', options: { typecheckTargetName: false } },
    ]);
    const before = tree.read('nx.json', 'utf-8');

    expect(registerTypescriptPluginForTypecheck(tree, '@nx/rsbuild')).toBe(
      false
    );
    expect(tree.read('nx.json', 'utf-8')).toBe(before);
  });

  it('should skip a workspace that already registers @nx/js/typescript', () => {
    setPlugins([
      '@nx/vite/plugin',
      { plugin: '@nx/js/typescript', include: ['packages/*'] },
    ]);
    const before = tree.read('nx.json', 'utf-8');

    expect(registerTypescriptPluginForTypecheck(tree, '@nx/vite/plugin')).toBe(
      false
    );
    expect(tree.read('nx.json', 'utf-8')).toBe(before);
  });

  it('should skip a workspace without a TS solution setup', () => {
    tree.delete('tsconfig.json');
    setPlugins(['@nx/vite/plugin']);
    const before = tree.read('nx.json', 'utf-8');

    expect(registerTypescriptPluginForTypecheck(tree, '@nx/vite/plugin')).toBe(
      false
    );
    expect(tree.read('nx.json', 'utf-8')).toBe(before);
  });

  it('should skip a workspace without the framework plugin', () => {
    setPlugins(['@nx/react/router-plugin']);
    const before = tree.read('nx.json', 'utf-8');

    expect(registerTypescriptPluginForTypecheck(tree, '@nx/vite/plugin')).toBe(
      false
    );
    expect(tree.read('nx.json', 'utf-8')).toBe(before);
  });
});
