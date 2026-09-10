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

const hashWithWorkspaceContext = vi.fn<() => Promise<string>>();

vi.mock('../../utils/workspace-context', () => ({
  hashWithWorkspaceContext: (...args: unknown[]) =>
    hashWithWorkspaceContext.apply(null, args as []),
}));

describe('computeCapabilityKey', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-capability-key-'));
    hashWithWorkspaceContext.mockReset();
    hashWithWorkspaceContext.mockResolvedValue('source-hash');
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
    const pluginPath = join(projectRoot, 'src', 'index.ts');
    writeFileSync(pluginPath, 'export const createNodes = [];');
    return pluginPath;
  }

  it('identifies an installed plugin by the version of the package it belongs to', async () => {
    const pluginPath = writeInstalledPlugin('1.2.3');

    const first = await computeCapabilityKey(pluginPath, root);
    const second = await computeCapabilityKey(pluginPath, root);

    expect(first).toEqual(second);
    // An installed package cannot change without its version changing, so the
    // version alone is enough and no file is read.
    expect(hashWithWorkspaceContext).not.toHaveBeenCalled();
  });

  it('gives an upgraded plugin a different key', async () => {
    const before = await computeCapabilityKey(
      writeInstalledPlugin('1.2.3'),
      root
    );
    const after = await computeCapabilityKey(
      writeInstalledPlugin('1.2.4'),
      root
    );

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

    expect(await computeCapabilityKey(pluginPath, root)).not.toEqual(
      await computeCapabilityKey(otherEntryPoint, root)
    );
  });

  it('identifies a workspace-local plugin by the hash of its project sources', async () => {
    const pluginPath = writeLocalPlugin();

    const before = await computeCapabilityKey(pluginPath, root);
    hashWithWorkspaceContext.mockResolvedValue('source-hash-after-an-edit');
    const after = await computeCapabilityKey(pluginPath, root);

    expect(before).not.toEqual(after);
    // The whole project is hashed, not just the entry file, because a hook is
    // commonly declared in a module the entry re-exports.
    expect(hashWithWorkspaceContext).toHaveBeenCalledWith(root, [
      'tools/my-plugin/**/*.{ts,tsx,cts,mts,js,cjs,mjs}',
      'tools/my-plugin/package.json',
    ]);
  });

  it('keys a local plugin on its own contents as well as the glob hash', async () => {
    const pluginPath = writeLocalPlugin();

    const before = await computeCapabilityKey(pluginPath, root);
    // A plugin the workspace ignores matches no glob, so the hash the context
    // returns never moves and only the entry file's own hash can.
    writeFileSync(pluginPath, 'export const createDependencies = () => [];');

    expect(await computeCapabilityKey(pluginPath, root)).not.toEqual(before);
  });

  it('declines a plugin with no project, rather than keying it on its entry file', async () => {
    // `nx.json` can name a bare file, and nothing between it and the root is a
    // project. Keying on the entry alone would miss a hook declared in a sibling
    // the entry re-exports, and a stale record there skips the hook silently.
    mkdirSync(join(root, 'tools'), { recursive: true });
    const pluginPath = join(root, 'tools', 'my-plugin.ts');
    writeFileSync(pluginPath, "export * from './hooks';");

    expect(await computeCapabilityKey(pluginPath, root)).toBeNull();
    expect(hashWithWorkspaceContext).not.toHaveBeenCalled();
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

    expect(await computeCapabilityKey(pluginPath, root)).toBeNull();
  });

  it('declines a plugin resolved outside the workspace', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'nx-linked-plugin-'));
    const pluginPath = join(outside, 'index.ts');
    writeFileSync(pluginPath, 'export const createNodes = [];');

    expect(await computeCapabilityKey(pluginPath, root)).toBeNull();
  });

  it('declines to identify a plugin when the cache is turned off', async () => {
    const pluginPath = writeInstalledPlugin('1.2.3');

    process.env.NX_PLUGIN_CAPABILITY_CACHE = 'false';
    try {
      expect(await computeCapabilityKey(pluginPath, root)).toBeNull();
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
