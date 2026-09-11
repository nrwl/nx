import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  capabilitiesOfLoadedPlugin,
  computeCapabilityKey,
  hashSourceFiles,
  recordIsFresh,
  storableSourceFiles,
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

    const first = computeCapabilityKey('@acme/plugin', pluginPath, root);
    const second = computeCapabilityKey('@acme/plugin', pluginPath, root);

    // Non-null as well as stable: both would be null if the package's manifest
    // could not be found, and a key nothing identifies caches nothing.
    expect(first).not.toBeNull();
    expect(first).toEqual(second);
    // An installed package cannot change without its version changing, so the
    // version alone is enough and no source file is read.
  });

  it('gives an upgraded plugin a different key', async () => {
    const before = computeCapabilityKey(
      '@acme/plugin',
      writeInstalledPlugin('1.2.3'),
      root
    );
    const after = computeCapabilityKey(
      '@acme/plugin',
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

    expect(computeCapabilityKey('@acme/plugin', pluginPath, root)).not.toEqual(
      computeCapabilityKey('@acme/plugin/src/other', otherEntryPoint, root)
    );
  });

  it('identifies a local plugin without reading its contents', async () => {
    const pluginPath = writeLocalPlugin();
    const first = computeCapabilityKey('@my-org/plugin', pluginPath, root);

    // Deliberate: the key says WHICH module this is, and the record says what
    // its sources were when Nx last read them.
    writeFileSync(pluginPath, 'export const createDependencies = () => [];');

    expect(computeCapabilityKey('@my-org/plugin', pluginPath, root)).toEqual(
      first
    );
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

    expect(
      computeCapabilityKey('@acme/unversioned', pluginPath, root)
    ).toBeNull();
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

describe('recordIsFresh', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-record-fresh-'));
  });

  function write(relativePath: string, contents: string): string {
    const path = join(root, relativePath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
    return path;
  }

  function recordFor(files: string[]) {
    const sourceFiles = storableSourceFiles(files, root);
    expect(sourceFiles).not.toBeNull();
    const sourceHash = hashSourceFiles(sourceFiles, root);
    expect(sourceHash).not.toBeNull();
    return {
      capabilities: {} as PluginCapabilities,
      sourceFiles,
      sourceHash,
    };
  }

  it('holds while every file the load read is unchanged', () => {
    const entry = write('libs/p/index.js', "require('./hooks');");
    const hooks = write('libs/p/hooks.js', 'module.exports = {};');

    expect(recordIsFresh(recordFor([entry, hooks]), root)).toBe(true);
  });

  it('fails when a module in another project changes', () => {
    const entry = write('libs/p/index.js', "require('../shared/hooks');");
    const shared = write('libs/shared/hooks.js', 'module.exports = {};');
    const record = recordFor([entry, shared]);

    // The gap a project-directory hash could not see, since no hash rooted at
    // one project reaches another.
    write(
      'libs/shared/hooks.js',
      'module.exports.postTasksExecution = () => {};'
    );

    expect(recordIsFresh(record, root)).toBe(false);
  });

  it('fails when a file the workspace ignores changes', () => {
    const entry = write('libs/p/index.js', "require('./generated');");
    const generated = write('libs/p/generated.js', 'module.exports = {};');
    write('.gitignore', 'libs/p/generated.js\n');
    const record = recordFor([entry, generated]);

    write('libs/p/generated.js', 'module.exports.createMetadata = () => ({});');

    expect(recordIsFresh(record, root)).toBe(false);
  });

  it('ignores a file the load never read, including build output', () => {
    const entry = write('libs/p/index.js', 'module.exports = {};');
    const record = recordFor([entry]);

    // Never read, so it decided nothing. This is what a directory walk had to
    // guess at by directory name.
    write('libs/p/dist/index.js', 'exports.stale = true;');
    write('libs/p/README.md', 'docs');

    expect(recordIsFresh(record, root)).toBe(true);
  });

  it('fails when a file the load read is deleted', () => {
    const entry = write('libs/p/index.js', "require('./hooks');");
    const hooks = write('libs/p/hooks.js', 'module.exports = {};');
    const record = recordFor([entry, hooks]);

    rmSync(hooks);

    expect(recordIsFresh(record, root)).toBe(false);
  });

  it.each([
    ['a directory', (p: string) => mkdirSync(p, { recursive: true })],
    [
      'an unreadable file',
      (p: string) => {
        writeFileSync(p, 'x');
        chmodSync(p, 0o000);
      },
    ],
    [
      'a dangling symlink',
      (p: string) => symlinkSync(join(root, 'never-existed.js'), p),
    ],
  ])('fails when a closure entry becomes %s', (_what, make) => {
    const entry = write('libs/p/index.js', 'module.exports = {};');
    const record = recordFor([entry]);

    // Each of these is unhashable while `existsSync` says it is there, so the
    // null from `hashFile` is what the check has to key on.
    rmSync(entry);
    make(entry);

    expect(recordIsFresh(record, root)).toBe(false);
  });

  it('cannot mistake an unhashable closure for an empty one', () => {
    const entry = write('libs/p/index.js', 'module.exports = {};');
    const record = recordFor([entry]);
    rmSync(entry);

    // `hashArray([])` and `hashArray([null])` are the same value, so a closure
    // of unreadable files would otherwise hash like a vendor-only one, which is
    // treated as valid.
    expect(hashSourceFiles(record.sourceFiles, root)).toBeNull();
    expect(recordIsFresh(record, root)).toBe(false);
    expect(
      recordIsFresh(
        {
          capabilities: {} as PluginCapabilities,
          sourceFiles: [],
          sourceHash: record.sourceHash,
        },
        root
      )
    ).toBe(true);
  });

  it('fails rather than folding a missing file into the same hash as none', () => {
    const entry = write('libs/p/index.js', "require('./hooks');");
    const hooks = write('libs/p/hooks.js', 'module.exports = {};');
    const record = recordFor([entry, hooks]);

    rmSync(entry);
    rmSync(hooks);

    // hashFile returns null for a missing path and hashArray folds null in as
    // though the entry were absent, so a closure whose every file is gone hashes
    // like an empty one. Checked rather than hashed for exactly that reason.
    expect(recordIsFresh(record, root)).toBe(false);
  });

  it('validates against the reading workspace, not the writing one', () => {
    // The database can be shared between worktrees of one repository, so a record
    // written by one is read by another. In-workspace entries are stored relative
    // and re-resolved against the current root, which is what makes sharing
    // correct rather than merely possible.
    const other = mkdtempSync(join(tmpdir(), 'nx-other-worktree-'));
    mkdirSync(join(other, 'libs/p'), { recursive: true });
    const sameContents = 'module.exports = {};';
    write('libs/p/index.js', sameContents);
    writeFileSync(join(other, 'libs/p/index.js'), sameContents);
    const record = recordFor([join(root, 'libs/p/index.js')]);

    expect(record.sourceFiles).toEqual(['libs/p/index.js']);
    expect(recordIsFresh(record, other)).toBe(true);

    // Edited here and untouched in the writing workspace, whose copy is still on
    // disk: a record must never be validated against another checkout's files.
    writeFileSync(
      join(other, 'libs/p/index.js'),
      'module.exports.postTasksExecution = async () => {};'
    );
    expect(recordIsFresh(record, other)).toBe(false);
    expect(recordIsFresh(record, root)).toBe(true);
  });

  it('declines to store a closure that reaches outside the workspace', () => {
    const inside = write('libs/p/index.js', "require('../../../shared/x');");
    const outside = join(root, '..', 'shared', 'x.js');

    // Two checkouts of one repository share a database and compute the same key
    // for this plugin, so a stored absolute path would let one validate against
    // the other's sibling directory.
    expect(storableSourceFiles([inside, outside], root)).toBeNull();
    expect(storableSourceFiles([inside], root)).toEqual(['libs/p/index.js']);
  });

  it('stores no hash for a plugin whose every source is vendored', () => {
    // A published plugin contributes nothing after vendor filtering, and its key
    // carries the version. Hashing the empty list would put a real-looking value
    // in a column no read compares.
    expect(hashSourceFiles([], root)).toBe('');
  });

  it('holds for a plugin whose every source is vendored', () => {
    // Nothing to hash, and the key carried the installed version.
    expect(
      recordIsFresh(
        {
          capabilities: {} as PluginCapabilities,
          sourceFiles: [],
          sourceHash: '',
        },
        root
      )
    ).toBe(true);
  });
});
