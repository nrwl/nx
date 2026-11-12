import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const dataDir = vi.hoisted(() => {
  const { mkdtempSync, realpathSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');
  return realpathSync(mkdtempSync(join(tmpdir(), 'evaluation-cache-data-')));
});
vi.mock('../../../utils/cache-directory', () => ({
  workspaceDataDirectory: dataDir,
}));
vi.mock('../../../utils/workspace-context', () => ({
  globWithWorkspaceContext: async () => [],
}));

import { EvaluationCache, readCallTrace } from './evaluation-cache';

describe('readCallTrace', () => {
  let dir: string;
  let logPath: string;
  const workerScript = resolve('/ws/node_modules/nx/plugin-worker.js');
  const markers = () => ({ logPath, workerScript });
  const write = (...lines: string[]) =>
    writeFileSync(logPath, lines.map((l) => l + '\n').join(''));

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'read-call-trace-'));
    logPath = join(dir, 'worker.log');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('should attribute the load phase and the call to the call', () => {
    write(
      workerScript,
      '/ws/tools/plugin.js',
      '!begin a',
      '/ws/libs/a/config.js',
      '!end a'
    );
    expect(readCallTrace(markers(), 'a')?.sort()).toEqual(
      [workerScript, '/ws/libs/a/config.js', '/ws/tools/plugin.js']
        .map((p) => resolve(p))
        .sort()
    );
  });

  it('should leave out reads that belong to other calls', () => {
    write(
      workerScript,
      '!begin a',
      '/ws/a.js',
      '!end a',
      '/ws/between.js',
      '!begin b',
      '/ws/b.js',
      '!end b'
    );
    expect(readCallTrace(markers(), 'b')).not.toContain(resolve('/ws/a.js'));
    expect(readCallTrace(markers(), 'b')).not.toContain(
      resolve('/ws/between.js')
    );
    expect(readCallTrace(markers(), 'b')).toContain(resolve('/ws/b.js'));
  });

  // Overlapping calls only add reads, which can cause an extra run but never a
  // stale result.
  it('should keep reads of a call that overlaps this one', () => {
    write(workerScript, '!begin a', '!begin b', '/ws/b.js', '!end b', '!end a');
    expect(readCallTrace(markers(), 'a')).toContain(resolve('/ws/b.js'));
  });

  it('should distrust a trace that never saw the worker start', () => {
    write('!begin a', '/ws/a.js', '!end a');
    expect(readCallTrace(markers(), 'a')).toBeNull();
  });

  it('should distrust a trace with an untraced child', () => {
    write(workerScript, '!begin a', '!untraced /usr/bin/sudo', '!end a');
    expect(readCallTrace(markers(), 'a')).toBeNull();
  });

  it('should distrust a call that has not finished', () => {
    write(workerScript, '!begin a', '/ws/a.js');
    expect(readCallTrace(markers(), 'a')).toBeNull();
  });

  it('should distrust a missing log', () => {
    expect(readCallTrace(markers(), 'a')).toBeNull();
  });
});

describe('EvaluationCache', () => {
  let dir: string;
  const context = { nxJsonConfiguration: {}, workspaceRoot: '/ws' };
  const results = [['plugin', 'a/config.js', { projects: {} }]] as const;
  const configFiles = ['a/config.js', 'b/config.js'];
  // Stored inputs must predate the call, so calls "start" in the future.
  const later = () => Date.now() + 60_000;
  let cache: EvaluationCache;
  let a: string;
  let b: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'evaluation-cache-'));
    a = join(dir, 'a.txt');
    b = join(dir, 'b.txt');
    writeFileSync(a, 'a');
    writeFileSync(b, 'b');
    cache = new EvaluationCache(`plugin-${Math.random()}`, 0, 'plugin');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));
  afterAll(() => rmSync(dataDir, { recursive: true, force: true }));

  it('should reuse results until an input changes', async () => {
    await cache.store(
      configFiles,
      context,
      [...results],
      [a, b],
      later(),
      true
    );
    expect(await cache.lookup(configFiles, context)).toEqual(results);

    writeFileSync(b, 'changed');
    expect(await cache.lookup(configFiles, context)).toBeNull();
  });

  it('should miss when the matched config files change', async () => {
    await cache.store(configFiles, context, [...results], [a], later(), true);
    expect(await cache.lookup(['a/config.js'], context)).toBeNull();
  });

  // A plugin's own cache answers unchanged projects without reading them.
  it('should carry inputs forward from the previous entry', async () => {
    await cache.store(
      configFiles,
      context,
      [...results],
      [a, b],
      later(),
      true
    );
    await cache.store(configFiles, context, [...results], [a], later(), false);
    expect(await cache.lookup(configFiles, context)).toEqual(results);

    writeFileSync(b, 'changed');
    expect(await cache.lookup(configFiles, context)).toBeNull();
  });

  it('should not store a run made with plugin caches on and nothing to build on', async () => {
    await cache.store(configFiles, context, [...results], [a], later(), false);
    expect(cache.hasEntry()).toBe(false);
  });

  it('should leave plugin cache files out of the inputs', async () => {
    const pluginCache = join(dataDir, 'plugin.hash');
    writeFileSync(pluginCache, '{}');
    await cache.store(configFiles, context, [...results], [a], later(), true);
    await cache.store(
      configFiles,
      context,
      [...results],
      [a, pluginCache],
      later(),
      false
    );
    writeFileSync(pluginCache, '{"rewritten":true}');
    expect(await cache.lookup(configFiles, context)).toEqual(results);
  });

  it('should not store a plugin that reads its own cache with caches off', async () => {
    const pluginCache = join(dataDir, 'gradle.json');
    writeFileSync(pluginCache, '{}');
    await cache.store(
      configFiles,
      context,
      [...results],
      [a, pluginCache],
      later(),
      true
    );
    expect(cache.hasEntry()).toBe(false);
  });

  it('should not store when an input was written during the call', async () => {
    await cache.store(configFiles, context, [...results], [a], 0, true);
    expect(cache.hasEntry()).toBe(false);
  });

  it('should record a read file that is gone as absent', async () => {
    const gone = join(dir, 'gone.txt');
    await cache.store(
      configFiles,
      context,
      [...results],
      [a, gone],
      later(),
      true
    );
    expect(await cache.lookup(configFiles, context)).toEqual(results);

    writeFileSync(gone, 'back');
    expect(await cache.lookup(configFiles, context)).toBeNull();
  });
});
