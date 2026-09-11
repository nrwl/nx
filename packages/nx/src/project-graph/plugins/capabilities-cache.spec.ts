import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  capabilitiesOfLoadedPlugin,
  computeCapabilityKey,
  sameCapabilities,
  type PluginCapabilities,
} from './capabilities-cache';
import type { LoadedNxPlugin } from './loaded-nx-plugin';

const state = vi.hoisted(() => ({ nxManifestVersion: '23.0.0' }));

// Only Nx's own manifest is faked. Everything else, including each plugin's
// package.json, is read from the temp workspace the test writes.
vi.mock('../../utils/fileutils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/fileutils')>();
  const nxManifest = join('packages', 'nx', 'package.json');
  return {
    ...actual,
    readJsonFile: (path: string, ...rest: unknown[]) =>
      path.endsWith(nxManifest)
        ? { version: state.nxManifestVersion }
        : (actual.readJsonFile as any)(path, ...rest),
  };
});

describe('computeCapabilityKey', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-capability-key-'));
    state.nxManifestVersion = '23.0.0';
  });

  function writeInstalledPlugin(version: string): string {
    const packageRoot = join(root, 'node_modules', '@acme', 'plugin');
    mkdirSync(join(packageRoot, 'src'), { recursive: true });
    writeFileSync(
      join(packageRoot, 'package.json'),
      JSON.stringify({ name: '@acme/plugin', version })
    );
    const pluginPath = join(packageRoot, 'src', 'index.js');
    writeFileSync(pluginPath, 'module.exports = {};');
    return pluginPath;
  }

  function writeLocalPlugin(): string {
    const projectRoot = join(root, 'tools', 'my-plugin');
    mkdirSync(join(projectRoot, 'src'), { recursive: true });
    writeFileSync(
      join(projectRoot, 'package.json'),
      JSON.stringify({ name: '@my-org/plugin' })
    );
    writeFileSync(
      join(projectRoot, 'src', 'hooks.ts'),
      'export const postTasksExecution = async () => {};'
    );
    const pluginPath = join(projectRoot, 'src', 'index.ts');
    writeFileSync(pluginPath, "export * from './hooks';");
    return pluginPath;
  }

  it('identifies an installed plugin by the version of the package it belongs to', async () => {
    const pluginPath = writeInstalledPlugin('1.2.3');

    const first = computeCapabilityKey(pluginPath, root);
    const second = computeCapabilityKey(pluginPath, root);

    expect(first).toEqual(second);
    // An installed package cannot change without its version changing, so the
    // version alone is enough and no file is read.
  });

  it('gives an upgraded plugin a different key', async () => {
    const before = computeCapabilityKey(writeInstalledPlugin('1.2.3'), root);
    const after = computeCapabilityKey(writeInstalledPlugin('1.2.4'), root);

    expect(before).not.toEqual(after);
  });

  it('distinguishes two entry points of one installed package', async () => {
    const pluginPath = writeInstalledPlugin('1.2.3');
    const otherEntryPoint = join(
      root,
      'node_modules',
      '@acme',
      'plugin',
      'src',
      'other.js'
    );
    writeFileSync(otherEntryPoint, 'module.exports = {};');

    expect(computeCapabilityKey(pluginPath, root)).not.toEqual(
      computeCapabilityKey(otherEntryPoint, root)
    );
  });

  it('moves when a module the entry re-exports changes', async () => {
    const pluginPath = writeLocalPlugin();
    const before = computeCapabilityKey(pluginPath, root);

    // The hook lives here rather than in the entry file, which is the usual
    // shape and the reason the whole project is hashed.
    writeFileSync(
      join(root, 'tools', 'my-plugin', 'src', 'hooks.ts'),
      'export const postTasksExecution = async () => { /* changed */ };'
    );

    expect(computeCapabilityKey(pluginPath, root)).not.toEqual(before);
  });

  it('moves when a file the workspace ignores changes', async () => {
    const pluginPath = writeLocalPlugin();
    const projectRoot = join(root, 'tools', 'my-plugin');
    writeFileSync(
      join(root, '.gitignore'),
      'tools/my-plugin/src/generated.ts\n'
    );
    writeFileSync(
      join(projectRoot, 'src', 'generated.ts'),
      'export const createMetadata = async () => ({});'
    );
    writeFileSync(pluginPath, "export * from './generated';");
    const before = computeCapabilityKey(pluginPath, root);

    // Generated code a plugin re-exports still decides what the record says, so
    // the walk cannot be the one the workspace context does.
    writeFileSync(
      join(projectRoot, 'src', 'generated.ts'),
      'export const createMetadata = async () => ({ changed: true });'
    );

    expect(computeCapabilityKey(pluginPath, root)).not.toEqual(before);
  });

  it('moves when the entry file itself changes', async () => {
    const pluginPath = writeLocalPlugin();
    const before = computeCapabilityKey(pluginPath, root);

    writeFileSync(pluginPath, 'export const createDependencies = () => [];');

    expect(computeCapabilityKey(pluginPath, root)).not.toEqual(before);
  });

  it("ignores the plugin project's own build output", async () => {
    const pluginPath = writeLocalPlugin();
    const projectRoot = join(root, 'tools', 'my-plugin');
    const before = computeCapabilityKey(pluginPath, root);

    // A local plugin built into its own project would otherwise mint a new
    // record on every rebuild.
    mkdirSync(join(projectRoot, 'dist'), { recursive: true });
    writeFileSync(join(projectRoot, 'dist', 'index.js'), 'exports.x = 1;');
    mkdirSync(join(projectRoot, '.cache'), { recursive: true });
    writeFileSync(join(projectRoot, '.cache', 'stale.js'), 'exports.y = 2;');

    expect(computeCapabilityKey(pluginPath, root)).toEqual(before);
  });

  it("ignores a change outside the plugin's project", async () => {
    const pluginPath = writeLocalPlugin();
    const before = computeCapabilityKey(pluginPath, root);

    mkdirSync(join(root, 'apps', 'unrelated'), { recursive: true });
    writeFileSync(join(root, 'apps', 'unrelated', 'main.ts'), 'export {};');

    expect(computeCapabilityKey(pluginPath, root)).toEqual(before);
  });

  it('moves when Nx itself changes version', async () => {
    const pluginPath = writeInstalledPlugin('1.2.3');
    const onOldNx = computeCapabilityKey(pluginPath, root);

    // A record says what Nx believed about a module, so a release that reads a
    // different set of exports must not read records written before it.
    state.nxManifestVersion = '24.0.0';
    vi.resetModules();
    const { computeCapabilityKey: onNewNxKey } =
      await import('./capabilities-cache');

    expect(onNewNxKey(pluginPath, root)).not.toEqual(onOldNx);
  });

  it('declines a plugin with no project, rather than keying it on its entry file', async () => {
    // `nx.json` can name a bare file, and nothing between it and the root is a
    // project. Keying on the entry alone would miss a hook declared in a sibling
    // the entry re-exports, and a stale record there skips the hook silently.
    mkdirSync(join(root, 'tools'), { recursive: true });
    const pluginPath = join(root, 'tools', 'my-plugin.ts');
    writeFileSync(pluginPath, "export * from './hooks';");

    expect(computeCapabilityKey(pluginPath, root)).toBeNull();
  });

  it('declines an installed package that declares no version', async () => {
    const packageRoot = join(root, 'node_modules', '@acme', 'unversioned');
    mkdirSync(packageRoot, { recursive: true });
    writeFileSync(
      join(packageRoot, 'package.json'),
      JSON.stringify({ name: '@acme/unversioned' })
    );
    // The workspace above it has one, and taking that would key every version of
    // this package the same.
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: 'the-workspace', version: '1.0.0' })
    );
    const pluginPath = join(packageRoot, 'index.js');
    writeFileSync(pluginPath, 'module.exports = {};');

    expect(computeCapabilityKey(pluginPath, root)).toBeNull();
  });

  it('declines a plugin resolved outside the workspace', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'nx-linked-plugin-'));
    const pluginPath = join(outside, 'index.ts');
    writeFileSync(pluginPath, 'export const createNodes = [];');

    expect(computeCapabilityKey(pluginPath, root)).toBeNull();
  });

  it('declines to identify a plugin when the cache is turned off', async () => {
    const pluginPath = writeInstalledPlugin('1.2.3');

    process.env.NX_PLUGIN_CAPABILITY_CACHE = 'false';
    try {
      expect(computeCapabilityKey(pluginPath, root)).toBeNull();
    } finally {
      delete process.env.NX_PLUGIN_CAPABILITY_CACHE;
    }
  });
});

describe('capabilitiesOfLoadedPlugin', () => {
  it('reads which hooks a loaded plugin registered', () => {
    const plugin = {
      name: '@acme/plugin',
      createNodes: ['**/*.config.js', async () => []],
      createMetadata: async () => ({}),
    } as unknown as LoadedNxPlugin;

    expect(capabilitiesOfLoadedPlugin(plugin)).toEqual({
      name: '@acme/plugin',
      createNodesPattern: '**/*.config.js',
      hasCreateDependencies: false,
      hasCreateMetadata: true,
      hasPreTasksExecution: false,
      hasPostTasksExecution: false,
    });
  });
});

describe('sameCapabilities', () => {
  const base: PluginCapabilities = {
    name: '@acme/plugin',
    createNodesPattern: '**/*.config.js',
    hasCreateDependencies: false,
    hasCreateMetadata: false,
    hasPreTasksExecution: false,
    hasPostTasksExecution: false,
  };

  it('holds for an identical record', () => {
    expect(sameCapabilities(base, { ...base })).toBe(true);
  });

  it.each([
    ['name', { name: 'renamed' }],
    ['createNodesPattern', { createNodesPattern: '**/*.json' }],
    ['hasCreateDependencies', { hasCreateDependencies: true }],
    ['hasCreateMetadata', { hasCreateMetadata: true }],
    ['hasPreTasksExecution', { hasPreTasksExecution: true }],
    ['hasPostTasksExecution', { hasPostTasksExecution: true }],
  ])('fails when %s differs', (_field, change) => {
    expect(sameCapabilities(base, { ...base, ...change })).toBe(false);
  });
});
