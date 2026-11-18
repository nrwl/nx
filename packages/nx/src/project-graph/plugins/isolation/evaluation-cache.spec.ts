import {
  linkSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const dataDir = vi.hoisted(() => {
  const { mkdtempSync, realpathSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');
  return realpathSync(mkdtempSync(join(tmpdir(), 'evaluation-cache-data-')));
});
vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>();
  return { ...fs, readdirSync: vi.fn(fs.readdirSync) };
});
vi.mock('../../../utils/cache-directory', () => ({
  workspaceDataDirectory: dataDir,
}));
vi.mock('../../../utils/workspace-context', () => ({
  globWithWorkspaceContext: async () => [],
}));

import {
  EvaluationCache,
  LoadResultCache,
  readCallTrace,
  readLoadTrace,
} from './evaluation-cache';

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
    expect(readCallTrace(markers(), 'a')?.reads.sort()).toEqual(
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
    expect(readCallTrace(markers(), 'b')?.reads).not.toContain(
      resolve('/ws/a.js')
    );
    expect(readCallTrace(markers(), 'b')?.reads).not.toContain(
      resolve('/ws/between.js')
    );
    expect(readCallTrace(markers(), 'b')?.reads).toContain(resolve('/ws/b.js'));
  });

  // Overlapping calls only add reads, which can cause an extra run but never a
  // stale result.
  it('should keep reads of a call that overlaps this one', () => {
    write(workerScript, '!begin a', '!begin b', '/ws/b.js', '!end b', '!end a');
    expect(readCallTrace(markers(), 'a')?.reads).toContain(resolve('/ws/b.js'));
  });

  it('should separate directory listings from reads', () => {
    write(
      workerScript,
      '!begin a',
      '!list /ws/libs',
      '/ws/libs/a.js',
      '!end a'
    );
    expect(readCallTrace(markers(), 'a')).toEqual({
      reads: [workerScript, resolve('/ws/libs/a.js')],
      listings: [resolve('/ws/libs')],
      writes: [],
    });
  });

  it('should separate files written from files read', () => {
    write(
      workerScript,
      '!begin a',
      '!write /ws/tmp.mjs',
      '/ws/tmp.mjs',
      '!end a'
    );
    expect(readCallTrace(markers(), 'a')).toEqual({
      reads: [workerScript, resolve('/ws/tmp.mjs')],
      listings: [],
      writes: [resolve('/ws/tmp.mjs')],
    });
  });

  it("should leave out the daemon's own files", () => {
    const serverProcess = join(dataDir, 'd', 'server-process.json');
    write(workerScript, '!begin a', serverProcess, '/ws/a.js', '!end a');
    expect(readCallTrace(markers(), 'a')?.reads).toEqual([
      workerScript,
      resolve('/ws/a.js'),
    ]);
  });

  it('should leave out listings of /proc itself', () => {
    write(workerScript, '!begin a', '!list /proc', '!list /ws', '!end a');
    expect(readCallTrace(markers(), 'a')?.listings).toEqual(
      process.platform === 'win32'
        ? [resolve('/proc'), resolve('/ws')]
        : [resolve('/ws')]
    );
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

describe('readLoadTrace', () => {
  let dir: string;
  let logPath: string;
  const workerScript = resolve('/ws/node_modules/nx/plugin-worker.js');
  const write = (...lines: string[]) =>
    writeFileSync(logPath, lines.map((l) => l + '\n').join(''));

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'read-load-trace-'));
    logPath = join(dir, 'worker.log');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('should stop at the first call', () => {
    write(workerScript, '/ws/plugin.js', '!begin a', '/ws/a.js', '!end a');
    expect(readLoadTrace({ logPath, workerScript })?.reads).toEqual([
      workerScript,
      resolve('/ws/plugin.js'),
    ]);
  });

  it('should accept a load with no call yet', () => {
    write(workerScript, '/ws/plugin.js');
    expect(readLoadTrace({ logPath, workerScript })?.reads).toHaveLength(2);
  });

  it('should distrust a load with an untraced child', () => {
    write(workerScript, '!untraced /usr/bin/sudo');
    expect(readLoadTrace({ logPath, workerScript })).toBeNull();
  });
});

describe('LoadResultCache', () => {
  let dir: string;
  let pluginFile: string;
  const result = { name: 'plugin', createNodesPattern: '**/a.json' };
  const later = () => Date.now() + 60_000;
  let cache: LoadResultCache<typeof result>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'load-result-cache-'));
    pluginFile = join(dir, 'plugin.js');
    writeFileSync(pluginFile, 'module.exports = {}');
    cache = new LoadResultCache(`plugin-${Math.random()}`, 0, 'plugin');
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.NX_LOAD_TEST;
  });

  it('should reuse the result until a file read while loading changes', () => {
    cache.store(
      result,
      { reads: [pluginFile], listings: [], writes: [] },
      later()
    );
    expect(cache.lookup()).toEqual(result);

    writeFileSync(pluginFile, 'module.exports = { changed: true }');
    expect(cache.lookup()).toBeNull();
  });

  it('should miss when the NX_ environment changes', () => {
    cache.store(
      result,
      { reads: [pluginFile], listings: [], writes: [] },
      later()
    );
    process.env.NX_LOAD_TEST = '1';
    expect(cache.lookup()).toBeNull();
  });

  it('should not store when a file changed while loading', () => {
    cache.store(result, { reads: [pluginFile], listings: [], writes: [] }, 0);
    expect(cache.lookup()).toBeNull();
  });

  it('should leave plugin cache files out', () => {
    const pluginCache = join(dataDir, 'load-plugin.hash');
    writeFileSync(pluginCache, '{}');
    cache.store(
      result,
      { reads: [pluginFile, pluginCache], listings: [], writes: [] },
      later()
    );
    writeFileSync(pluginCache, '{"rewritten":true}');
    expect(cache.lookup()).toEqual(result);
  });
});

describe('EvaluationCache', () => {
  let dir: string;
  const context = { nxJsonConfiguration: {}, workspaceRoot: '/ws' };
  const results = [['plugin', 'a/config.js', { projects: {} }]] as const;
  const configFiles = ['a/config.js', 'b/config.js'];
  // Stored inputs must predate the call, so calls "start" in the future.
  const later = () => Date.now() + 60_000;
  const t = (
    reads: string[],
    listings: string[] = [],
    writes: string[] = []
  ) => ({
    reads,
    listings,
    writes,
  });
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
      t([a, b]),
      later(),
      true
    );
    expect(await cache.lookup(configFiles, context)).toEqual(results);

    writeFileSync(b, 'changed');
    expect(await cache.lookup(configFiles, context)).toBeNull();
  });

  it('should miss when the matched config files change', async () => {
    await cache.store(
      configFiles,
      context,
      [...results],
      t([a]),
      later(),
      true
    );
    expect(await cache.lookup(['a/config.js'], context)).toBeNull();
  });

  // A plugin's own cache answers unchanged projects without reading them.
  it('should carry inputs forward from the previous entry', async () => {
    await cache.store(
      configFiles,
      context,
      [...results],
      t([a, b]),
      later(),
      true
    );
    await cache.store(
      configFiles,
      context,
      [...results],
      t([a]),
      later(),
      false
    );
    expect(await cache.lookup(configFiles, context)).toEqual(results);

    writeFileSync(b, 'changed');
    expect(await cache.lookup(configFiles, context)).toBeNull();
  });

  it('should not store a run made with plugin caches on and nothing to build on', async () => {
    await cache.store(
      configFiles,
      context,
      [...results],
      t([a]),
      later(),
      false
    );
    expect(cache.hasEntry()).toBe(false);
  });

  it('should leave plugin cache files out of the inputs', async () => {
    const pluginCache = join(dataDir, 'plugin.hash');
    writeFileSync(pluginCache, '{}');
    await cache.store(
      configFiles,
      context,
      [...results],
      t([a]),
      later(),
      true
    );
    await cache.store(
      configFiles,
      context,
      [...results],
      t([a, pluginCache]),
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
      t([a, pluginCache]),
      later(),
      true
    );
    expect(cache.hasEntry()).toBe(false);
  });

  it('should not store when an input was written during the call', async () => {
    await cache.store(configFiles, context, [...results], t([a]), 0, true);
    expect(cache.hasEntry()).toBe(false);
  });

  it('should ignore link count changes to a hardlinked input', async () => {
    const storeCopy = join(dir, 'store-copy.txt');
    linkSync(a, storeCopy);
    await cache.store(
      configFiles,
      context,
      [...results],
      t([a]),
      later(),
      true
    );
    linkSync(a, join(dir, 'another-install.txt'));
    rmSync(join(dir, 'another-install.txt'));
    expect(await cache.lookup(configFiles, context)).toEqual(results);

    writeFileSync(storeCopy, 'changed');
    expect(await cache.lookup(configFiles, context)).toBeNull();
  });

  it('should record a read file that is gone as absent', async () => {
    const gone = join(dir, 'gone.txt');
    await cache.store(
      configFiles,
      context,
      [...results],
      t([a, gone]),
      later(),
      true
    );
    expect(await cache.lookup(configFiles, context)).toEqual(results);

    writeFileSync(gone, 'back');
    expect(await cache.lookup(configFiles, context)).toBeNull();
  });

  it('should not store when an input was removed during the call', async () => {
    const started = Date.now();
    rmSync(b);
    await cache.store(
      configFiles,
      context,
      [...results],
      t([b]),
      started,
      true
    );
    expect(cache.hasEntry()).toBe(false);
  });

  it('should record a temporary file the call wrote and removed as absent', async () => {
    await new Promise((r) => setTimeout(r, 20));
    const started = Date.now();
    const temp = join(dir, 'config.timestamp-1.mjs');
    writeFileSync(temp, 'export default {}');
    rmSync(temp);
    await cache.store(
      configFiles,
      context,
      [...results],
      t([a, temp], [], [temp]),
      started,
      true
    );
    expect(await cache.lookup(configFiles, context)).toEqual(results);

    writeFileSync(temp, 'back');
    expect(await cache.lookup(configFiles, context)).toBeNull();
  });

  describe('listings', () => {
    let listed: string;

    beforeEach(() => {
      listed = join(dir, 'listed');
      mkdirSync(listed);
      writeFileSync(join(listed, 'one.txt'), '1');
    });

    it('should miss when a listed directory gains an entry', async () => {
      await cache.store(
        configFiles,
        context,
        [...results],
        t([a], [listed]),
        later(),
        true
      );
      expect(await cache.lookup(configFiles, context)).toEqual(results);

      writeFileSync(join(listed, 'two.txt'), '2');
      expect(await cache.lookup(configFiles, context)).toBeNull();
    });

    it('should ignore content changes to entries that were only listed', async () => {
      await cache.store(
        configFiles,
        context,
        [...results],
        t([a], [listed]),
        later(),
        true
      );
      writeFileSync(join(listed, 'one.txt'), 'changed');
      expect(await cache.lookup(configFiles, context)).toEqual(results);
    });

    it('should carry listings forward from the previous entry', async () => {
      await cache.store(
        configFiles,
        context,
        [...results],
        t([a], [listed]),
        later(),
        true
      );
      await cache.store(
        configFiles,
        context,
        [...results],
        t([a]),
        later(),
        false
      );

      rmSync(join(listed, 'one.txt'));
      expect(await cache.lookup(configFiles, context)).toBeNull();
    });

    it('should not store when a listed directory changed during the call', async () => {
      await cache.store(
        configFiles,
        context,
        [...results],
        t([], [listed]),
        Date.now() - 60_000,
        true
      );
      expect(cache.hasEntry()).toBe(false);
    });

    it('should not store when a listed directory gains an entry as it is fingerprinted', async () => {
      await new Promise((r) => setTimeout(r, 20));
      const started = Date.now();
      const real = vi.mocked(readdirSync).getMockImplementation()!;
      vi.mocked(readdirSync).mockImplementationOnce(((path, options) => {
        writeFileSync(join(listed, 'two.txt'), '2');
        return real(path, options);
      }) as typeof readdirSync);

      await cache.store(
        configFiles,
        context,
        [...results],
        t([], [listed]),
        started,
        true
      );
      expect(cache.hasEntry()).toBe(false);
    });

    it('should not store when a listed directory was removed during the call', async () => {
      const started = Date.now();
      rmSync(listed, { recursive: true });
      await cache.store(
        configFiles,
        context,
        [...results],
        t([], [listed]),
        started,
        true
      );
      expect(cache.hasEntry()).toBe(false);
    });

    it('should store a listing of a directory that never existed', async () => {
      const missing = join(dir, 'missing', 'deeper');
      await cache.store(
        configFiles,
        context,
        [...results],
        t([], [missing]),
        later(),
        true
      );
      expect(await cache.lookup(configFiles, context)).toEqual(results);

      mkdirSync(missing, { recursive: true });
      expect(await cache.lookup(configFiles, context)).toBeNull();
    });

    it('should leave listings of plugin cache directories out', async () => {
      const pluginCaches = join(dataDir, 'listed-cache');
      mkdirSync(pluginCaches, { recursive: true });
      await cache.store(
        configFiles,
        context,
        [...results],
        t([a], [pluginCaches]),
        later(),
        true
      );
      writeFileSync(join(pluginCaches, 'new.hash'), '{}');
      expect(await cache.lookup(configFiles, context)).toEqual(results);
    });
  });
});
