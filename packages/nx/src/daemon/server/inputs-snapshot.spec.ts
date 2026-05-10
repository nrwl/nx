import { join } from 'node:path';
import { writeFileSync, utimesSync, mkdirSync, unlinkSync } from 'node:fs';

import { TempFs } from '../../internal-testing-utils/temp-fs';
import type { LoadedNxPlugin } from '../../project-graph/plugins/loaded-nx-plugin';
import type { SeparatedPlugins } from '../../project-graph/plugins/get-plugins';

jest.mock('../../utils/workspace-context', () => ({
  globWithWorkspaceContext: jest.fn(async () => []),
}));

jest.mock('../logger', () => ({
  serverLogger: { log: jest.fn(), requestLog: jest.fn() },
}));

import { globWithWorkspaceContext } from '../../utils/workspace-context';
import {
  capturePluginInputs,
  capturePreComputeInputs,
  combineInputsSnapshot,
  detectInputsDrift,
} from './inputs-snapshot';

const mockedGlob = globWithWorkspaceContext as jest.MockedFunction<
  typeof globWithWorkspaceContext
>;

function plugin(name: string, glob: string | null = null): LoadedNxPlugin {
  // Bypass the constructor; the snapshot only reads `.createNodes[0]`,
  // which is the simplest shape we can fake.
  const p = Object.create(
    require('../../project-graph/plugins/loaded-nx-plugin').LoadedNxPlugin
      .prototype
  );
  Object.defineProperty(p, 'name', { value: name });
  if (glob) {
    Object.defineProperty(p, 'createNodes', {
      value: [glob, async () => []],
    });
  }
  return p;
}

function separated(...plugins: LoadedNxPlugin[]): SeparatedPlugins {
  return { specifiedPlugins: plugins, defaultPlugins: [] };
}

/**
 * Convenience wrapper that mirrors the pre+post phases the daemon does.
 * The daemon captures `capturePreComputeInputs()` BEFORE
 * `getPluginsSeparated`; the test harness simulates that ordering.
 */
async function snapshot(plugins: SeparatedPlugins) {
  const pre = await capturePreComputeInputs();
  const pluginInputs = await capturePluginInputs(plugins);
  return combineInputsSnapshot(pre, pluginInputs);
}

function bumpMtime(absPath: string, deltaMs = 2000) {
  // Push mtime far enough forward that even coarse-resolution
  // filesystems (NFS, HFS+ at 1s) register a different signature.
  const future = new Date(Date.now() + deltaMs);
  utimesSync(absPath, future, future);
}

describe('inputs-snapshot', () => {
  let fs: TempFs;

  beforeEach(() => {
    fs = new TempFs('inputs-snapshot');
    mockedGlob.mockReset();
    mockedGlob.mockResolvedValue([]);
  });

  afterEach(() => {
    fs.cleanup();
  });

  it('reports no drift when nothing has changed since capture', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({ plugins: [] }),
      'package.json': JSON.stringify({ name: 'root' }),
    });
    const snap = await snapshot(separated());
    expect(await detectInputsDrift(snap)).toBeNull();
  });

  it('detects a same-length rewrite of nx.json via mtime drift', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({ plugins: [], a: 1 }),
      'package.json': JSON.stringify({ name: 'root' }),
    });
    const snap = await snapshot(separated());

    const before = JSON.stringify({ plugins: [], a: 1 });
    const after = JSON.stringify({ plugins: [], a: 2 });
    expect(after).toHaveLength(before.length);
    writeFileSync(join(fs.tempDir, 'nx.json'), after);
    // Bump mtime explicitly so coarse-resolution filesystems still
    // register a different signature.
    bumpMtime(join(fs.tempDir, 'nx.json'));

    const drift = await detectInputsDrift(snap);
    expect(drift).not.toBeNull();
    expect(drift?.kind).toBe('nx-json');
  });

  it('detects a change to root package.json', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({ plugins: [] }),
      'package.json': JSON.stringify({ name: 'root', version: '1.0.0' }),
    });
    const snap = await snapshot(separated());

    writeFileSync(
      join(fs.tempDir, 'package.json'),
      JSON.stringify({ name: 'root', version: '2.0.0' })
    );
    bumpMtime(join(fs.tempDir, 'package.json'));

    const drift = await detectInputsDrift(snap);
    expect(drift?.kind).toBe('root-package-json');
  });

  it('detects a change to a workspace plugin source file', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({ plugins: ['./tools/plugin-foo'] }),
      'package.json': JSON.stringify({ name: 'root' }),
      'tools/plugin-foo.js': 'module.exports = { name: "foo" };',
    });
    const snap = await snapshot(separated(plugin('foo')));
    expect(snap.pluginSources.size).toBe(1);

    bumpMtime(join(fs.tempDir, 'tools/plugin-foo.js'));

    const drift = await detectInputsDrift(snap);
    expect(drift?.kind).toBe('plugin-source');
  });

  it('detects deletion of a workspace plugin source file', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({ plugins: ['./tools/plugin-foo'] }),
      'package.json': JSON.stringify({ name: 'root' }),
      'tools/plugin-foo.js': 'module.exports = { name: "foo" };',
    });
    const snap = await snapshot(separated(plugin('foo')));

    unlinkSync(join(fs.tempDir, 'tools/plugin-foo.js'));

    const drift = await detectInputsDrift(snap);
    expect(drift?.kind).toBe('plugin-source');
  });

  it('ignores npm-resolved plugin specs (no source-file tracking)', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({ plugins: ['@nx/eslint'] }),
      'package.json': JSON.stringify({ name: 'root' }),
    });
    const snap = await snapshot(separated(plugin('@nx/eslint')));
    expect(snap.pluginSources.size).toBe(0);
  });

  it('captures and detects drift on plugin glob inputs', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({ plugins: ['@nx/foo'] }),
      'package.json': JSON.stringify({ name: 'root' }),
      'libs/a/project.json': JSON.stringify({ name: 'a' }),
      'libs/b/project.json': JSON.stringify({ name: 'b' }),
    });
    mockedGlob.mockResolvedValue([
      'libs/a/project.json',
      'libs/b/project.json',
    ]);

    const snap = await snapshot(
      separated(plugin('@nx/foo', 'libs/*/project.json'))
    );
    expect(snap.pluginInputs.size).toBe(2);

    bumpMtime(join(fs.tempDir, 'libs/a/project.json'));

    const drift = await detectInputsDrift(snap);
    expect(drift?.kind).toBe('plugin-input');
    expect((drift as { path?: string }).path).toBe('libs/a/project.json');
  });

  it('detects deletion of a plugin-watched file', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({ plugins: ['@nx/foo'] }),
      'package.json': JSON.stringify({ name: 'root' }),
      'libs/a/project.json': JSON.stringify({ name: 'a' }),
    });
    mockedGlob.mockResolvedValue(['libs/a/project.json']);

    const snap = await snapshot(
      separated(plugin('@nx/foo', 'libs/*/project.json'))
    );

    unlinkSync(join(fs.tempDir, 'libs/a/project.json'));

    const drift = await detectInputsDrift(snap);
    expect(drift?.kind).toBe('plugin-input');
  });

  it('ignores plugins that do not declare a createNodesV2 glob', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({ plugins: ['@nx/no-glob'] }),
      'package.json': JSON.stringify({ name: 'root' }),
    });

    const snap = await snapshot(separated(plugin('@nx/no-glob', null)));
    expect(snap.pluginInputs.size).toBe(0);
    expect(mockedGlob).not.toHaveBeenCalled();
  });

  it('handles a missing nx.json without throwing', async () => {
    fs.createFilesSync({
      'package.json': JSON.stringify({ name: 'root' }),
    });
    const snap = await snapshot(separated());
    expect(snap.nxJsonSignature).toBe('missing');
    expect(await detectInputsDrift(snap)).toBeNull();
  });

  it('treats reappearance of a previously-missing file as drift', async () => {
    fs.createFilesSync({
      'package.json': JSON.stringify({ name: 'root' }),
    });
    const snap = await snapshot(separated());
    expect(snap.nxJsonSignature).toBe('missing');

    writeFileSync(join(fs.tempDir, 'nx.json'), JSON.stringify({ plugins: [] }));

    const drift = await detectInputsDrift(snap);
    expect(drift?.kind).toBe('nx-json');
  });

  it('resolves workspace plugin specs across common extensions', async () => {
    mkdirSync(join(fs.tempDir, 'tools'), { recursive: true });
    writeFileSync(
      join(fs.tempDir, 'tools/plugin-cjs.cjs'),
      'module.exports = { name: "cjs" };'
    );
    writeFileSync(
      join(fs.tempDir, 'tools/plugin-mjs.mjs'),
      'export default { name: "mjs" };'
    );
    fs.createFilesSync({
      'nx.json': JSON.stringify({
        plugins: ['./tools/plugin-cjs', './tools/plugin-mjs'],
      }),
      'package.json': JSON.stringify({ name: 'root' }),
    });

    const snap = await snapshot(separated(plugin('cjs'), plugin('mjs')));
    expect(snap.pluginSources.size).toBe(2);
  });

  // Regression for the timing bug: capturing a snapshot AFTER compute
  // would mean a write that happened DURING compute is recorded in the
  // snapshot — masking drift on the next request even though the
  // cached graph reflects the pre-write state. The fix is to capture
  // workspace-level inputs (nx.json, root package.json, plugin
  // sources) BEFORE the compute reads them. This test simulates the
  // race: pre-compute snapshot taken, then nx.json is rewritten as if
  // a test mutated it during compute, then drift check must report
  // drift against the pre-compute baseline.
  it('detects nx.json drift when capture happens before disk is mutated', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({ plugins: [] }),
      'package.json': JSON.stringify({ name: 'root' }),
    });

    // Step 1: pre-compute capture, simulating what kickOffRecompute
    // does BEFORE getPluginsSeparated reads disk.
    const pre = await capturePreComputeInputs();

    // Step 2: simulate the test writing nx.json mid-compute (the
    // watcher-race scenario the daemon fix is for).
    writeFileSync(
      join(fs.tempDir, 'nx.json'),
      JSON.stringify({ plugins: ['./tools/plugin-foo'] })
    );

    // Step 3: post-compute plugin-input capture sees an empty plugin
    // list because the compute used the pre-write plugin set ([]).
    const pluginInputs = await capturePluginInputs(separated());

    const snap = combineInputsSnapshot(pre, pluginInputs);

    // The pre-compute snapshot's nx.json hash is from the pre-write
    // state, so a drift check now correctly detects the post-write
    // disk content.
    const drift = await detectInputsDrift(snap);
    expect(drift?.kind).toBe('nx-json');
  });
});
