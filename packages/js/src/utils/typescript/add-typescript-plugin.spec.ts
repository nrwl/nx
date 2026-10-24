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
  ensureTypescriptPlugin,
  registerTypescriptPluginForTypecheck,
} from './add-typescript-plugin';

describe('ensureTypescriptPlugin', () => {
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

    await ensureTypescriptPlugin(tree);

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

    await ensureTypescriptPlugin(tree);

    expect(typescriptRegistrations()).toEqual([
      { plugin: '@nx/js/typescript', include: ['packages/a/*'] },
    ]);
  });

  it('should register next to a scoped registration without typecheck', async () => {
    setUpTsSolution();
    const nodeApp = {
      plugin: '@nx/js/typescript',
      include: ['apps/api/*'],
      options: {
        typecheck: false,
        build: { targetName: 'build', configName: 'tsconfig.app.json' },
      },
    };
    const nxJson = readNxJson(tree);
    nxJson.plugins = [nodeApp, '@nx/vite/plugin'];
    updateNxJson(tree, nxJson);

    await ensureTypescriptPlugin(tree, false, '@nx/vite/plugin');

    const plugins = readNxJson(tree).plugins;
    expect(plugins[0]).toEqual(nodeApp);
    expect(plugins[1]).toMatchObject({
      plugin: '@nx/js/typescript',
      options: { typecheck: { targetName: 'typecheck' } },
    });
    expect(plugins[2]).toBe('@nx/vite/plugin');
  });

  it('should add a typecheck entry next to an unscoped one without typecheck', async () => {
    const disabled = {
      plugin: '@nx/js/typescript',
      options: { typecheck: false },
    };
    const nxJson = readNxJson(tree);
    nxJson.plugins = [disabled, '@nx/vite/plugin'];
    updateNxJson(tree, nxJson);

    await ensureTypescriptPlugin(tree, false, '@nx/vite/plugin');

    expect(readNxJson(tree).plugins).toEqual([
      disabled,
      {
        plugin: '@nx/js/typescript',
        options: { typecheck: { targetName: 'typecheck' } },
      },
      '@nx/vite/plugin',
    ]);
  });

  it('should place the registration before the framework plugin', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins = ['@nx/vite/plugin', '@nx/eslint/plugin'];
    updateNxJson(tree, nxJson);

    await ensureTypescriptPlugin(tree, false, '@nx/vite/plugin');

    expect(
      readNxJson(tree).plugins.map((p) =>
        typeof p === 'string' ? p : p.plugin
      )
    ).toEqual(['@nx/js/typescript', '@nx/vite/plugin', '@nx/eslint/plugin']);
  });

  it('should register only the typecheck target outside a TS solution setup', async () => {
    await ensureTypescriptPlugin(tree);

    expect(typescriptRegistrations()).toEqual([
      {
        plugin: '@nx/js/typescript',
        options: { typecheck: { targetName: 'typecheck' } },
      },
    ]);
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
      {
        plugin: '@nx/js/typescript',
        options: { typecheck: { targetName: 'typecheck' } },
      },
      '@nx/vite/plugin',
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

    expect(readNxJson(tree).plugins[0]).toEqual({
      plugin: '@nx/js/typescript',
      options: { typecheck: { targetName: 'remix:typecheck' } },
    });
  });

  it("should carry over the framework plugin's tsgo compiler", () => {
    setPlugins([{ plugin: '@nx/vite/plugin', options: { compiler: 'tsgo' } }]);

    registerTypescriptPluginForTypecheck(tree, '@nx/vite/plugin');

    expect(readNxJson(tree).plugins[0]).toEqual({
      plugin: '@nx/js/typescript',
      options: { typecheck: { targetName: 'typecheck' }, compiler: 'tsgo' },
    });
  });

  it('should not carry over a vue-tsc compiler', () => {
    setPlugins([
      { plugin: '@nx/vite/plugin', options: { compiler: 'vue-tsc' } },
    ]);

    registerTypescriptPluginForTypecheck(tree, '@nx/vite/plugin');

    expect(readNxJson(tree).plugins[0]).toEqual({
      plugin: '@nx/js/typescript',
      options: { typecheck: { targetName: 'typecheck' } },
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

  it('should register next to a scoped registration without typecheck', () => {
    const nodeApp = {
      plugin: '@nx/js/typescript',
      include: ['apps/api/*'],
      options: {
        typecheck: false,
        build: { targetName: 'build', configName: 'tsconfig.app.json' },
      },
    };
    setPlugins([nodeApp, '@nx/vite/plugin']);

    expect(registerTypescriptPluginForTypecheck(tree, '@nx/vite/plugin')).toBe(
      true
    );

    expect(readNxJson(tree).plugins).toEqual([
      nodeApp,
      {
        plugin: '@nx/js/typescript',
        options: { typecheck: { targetName: 'typecheck' } },
      },
      '@nx/vite/plugin',
    ]);
  });

  it('should register next to an unscoped registration without typecheck', () => {
    const disabled = {
      plugin: '@nx/js/typescript',
      options: { typecheck: false },
    };
    setPlugins([disabled, '@nx/vite/plugin']);

    expect(registerTypescriptPluginForTypecheck(tree, '@nx/vite/plugin')).toBe(
      true
    );

    expect(readNxJson(tree).plugins).toEqual([
      disabled,
      {
        plugin: '@nx/js/typescript',
        options: { typecheck: { targetName: 'typecheck' } },
      },
      '@nx/vite/plugin',
    ]);
  });

  it('should register before the framework plugin', () => {
    setPlugins(['@nx/eslint/plugin', '@nx/vite/plugin', '@nx/jest/plugin']);

    registerTypescriptPluginForTypecheck(tree, '@nx/vite/plugin');

    expect(
      readNxJson(tree).plugins.map((p) =>
        typeof p === 'string' ? p : p.plugin
      )
    ).toEqual([
      '@nx/eslint/plugin',
      '@nx/js/typescript',
      '@nx/vite/plugin',
      '@nx/jest/plugin',
    ]);
  });

  it('should register outside a TS solution setup', () => {
    tree.delete('tsconfig.json');
    setPlugins(['@nx/vite/plugin']);

    expect(registerTypescriptPluginForTypecheck(tree, '@nx/vite/plugin')).toBe(
      true
    );
  });

  it('should drop typecheckTargetName from the framework plugin when asked', () => {
    setPlugins([
      {
        plugin: '@nx/rsbuild',
        options: { buildTargetName: 'build', typecheckTargetName: 'check' },
      },
    ]);

    registerTypescriptPluginForTypecheck(tree, '@nx/rsbuild', {
      removeTypecheckTargetName: true,
    });

    expect(readNxJson(tree).plugins).toEqual([
      {
        plugin: '@nx/js/typescript',
        options: { typecheck: { targetName: 'check' } },
      },
      { plugin: '@nx/rsbuild', options: { buildTargetName: 'build' } },
    ]);
  });

  it('should drop typecheckTargetName: false without registering', () => {
    setPlugins([
      { plugin: '@nx/rsbuild', options: { typecheckTargetName: false } },
    ]);

    expect(
      registerTypescriptPluginForTypecheck(tree, '@nx/rsbuild', {
        removeTypecheckTargetName: true,
      })
    ).toBe(true);
    expect(readNxJson(tree).plugins).toEqual([
      { plugin: '@nx/rsbuild', options: {} },
    ]);
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
