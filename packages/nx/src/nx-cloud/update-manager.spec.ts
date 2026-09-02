import type { AxiosInstance } from 'axios';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { type ChildProcess, spawn } from 'child_process';
import { Readable } from 'stream';
import * as tar from 'tar-stream';
import { createGzip } from 'zlib';

type UpdateManager = typeof import('./update-manager');

/** A gzipped tarball shaped like a real client bundle. */
function bundleTarball(files: Record<string, string>): Readable {
  const pack = tar.pack();
  const dirs = new Set<string>();
  for (const name of Object.keys(files)) {
    const slash = name.lastIndexOf('/');
    if (slash > -1) dirs.add(name.slice(0, slash));
  }
  // Entries are extracted in order and nested files are written with plain
  // createWriteStream, so parent directories have to arrive first.
  for (const dir of dirs) pack.entry({ name: dir, type: 'directory' });
  for (const [name, content] of Object.entries(files)) {
    pack.entry({ name }, content);
  }
  pack.finalize();
  return pack.pipe(createGzip());
}

function axiosServing(data: Readable | (() => Readable)): AxiosInstance {
  return {
    get: vi.fn(async () => ({
      data: typeof data === 'function' ? data() : data,
    })),
  } as unknown as AxiosInstance;
}

function axiosFailing(error: Error): AxiosInstance {
  return {
    get: vi.fn(async () => Promise.reject(error)),
  } as unknown as AxiosInstance;
}

// A stand-in for a second nx process contending for the download lock. It
// takes the real native flock on the real lockfile and writes the same
// "<version> <nonce>" record, so the code under test is exercised against a
// genuine cross-process holder rather than a stub.
const PEER_SOURCE = `
const { FileLock } = require(process.argv[2]);
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const [installDir, version, holdMs, mode] = process.argv.slice(3);
const lockPath = path.join(installDir, 'download.lock');

const lock = new FileLock(lockPath);
lock.lock();
fs.writeFileSync(lockPath, version + ' ' + randomUUID(), 'utf-8');
fs.writeFileSync(path.join(installDir, 'peer-holds.flag'), '', 'utf-8');

setTimeout(() => {
  if (mode === 'install') {
    const dir = path.join(installDir, version);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.js'), 'peer bundle', 'utf-8');
  }
  lock.unlock();
}, Number(holdMs));
`;

// import.meta is unavailable under the CommonJS spec build, so walk up from
// the cwd instead - it differs between a direct vitest run and an nx one.
function findNativeBindings(): string {
  let dir = process.cwd();
  while (true) {
    for (const rel of [
      'src/native/native-bindings.js',
      'packages/nx/src/native/native-bindings.js',
    ]) {
      const candidate = join(dir, rel);
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) throw new Error('could not locate native bindings');
    dir = parent;
  }
}

const nativeBindings = findNativeBindings();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('update-manager bundle download', () => {
  let workspace: string;
  let installDir: string;
  let updateManager: UpdateManager;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    workspace = mkdtempSync(join(tmpdir(), 'nx-update-manager-'));
    // getBundleInstallDefaultLocation() only reaches the cacheDir branch when
    // the root looks like a workspace.
    writeFileSync(join(workspace, 'nx.json'), '{}');

    vi.resetModules();
    const { setWorkspaceRoot } = await import('../utils/workspace-root');
    setWorkspaceRoot(workspace);
    const { resetSharedRootCacheForTesting } =
      await import('../utils/cache-directory');
    resetSharedRootCacheForTesting();

    updateManager = await import('./update-manager');
    installDir = updateManager.getBundleInstallDefaultLocation();
    mkdirSync(installDir, { recursive: true });

    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    rmSync(workspace, { recursive: true, force: true });
    rmSync(installDir, { recursive: true, force: true });
  });

  const bundleDirs = () =>
    readdirSync(installDir)
      .filter((f) => statSync(join(installDir, f)).isDirectory())
      .sort();

  it('extracts the downloaded tarball into a directory named for the version', async () => {
    const axios = axiosServing(
      bundleTarball({
        'index.js': 'module.exports = { commands: {} };',
        'lib/inner.js': 'module.exports = 1;',
      })
    );

    const installed = await updateManager.downloadAndExtractClientBundle(
      axios,
      '2608.30.0002',
      'https://example.com/bundle.tar.gz'
    );

    expect(installed).toEqual({
      version: '2608.30.0002',
      fullPath: join(installDir, '2608.30.0002'),
    });
    expect(readFileSync(join(installed.fullPath, 'index.js'), 'utf-8')).toBe(
      'module.exports = { commands: {} };'
    );
    expect(
      readFileSync(join(installed.fullPath, 'lib/inner.js'), 'utf-8')
    ).toBe('module.exports = 1;');
    expect(axios.get).toHaveBeenCalledWith(
      'https://example.com/bundle.tar.gz',
      {
        responseType: 'stream',
      }
    );
  });

  it('records the installed version and a nonce in the download lockfile', async () => {
    await updateManager.downloadAndExtractClientBundle(
      axiosServing(bundleTarball({ 'index.js': '' })),
      '2608.30.0002',
      'https://example.com/bundle.tar.gz'
    );

    const record = readFileSync(join(installDir, 'download.lock'), 'utf-8');
    const [version, nonce] = record.trim().split(' ');
    expect(version).toBe('2608.30.0002');
    expect(nonce).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('writes a distinct nonce per install so a repeat of the same version is distinguishable', async () => {
    const download = () =>
      updateManager.downloadAndExtractClientBundle(
        axiosServing(bundleTarball({ 'index.js': '' })),
        '2608.30.0002',
        'https://example.com/bundle.tar.gz'
      );

    await download();
    const first = readFileSync(join(installDir, 'download.lock'), 'utf-8');
    await download();
    const second = readFileSync(join(installDir, 'download.lock'), 'utf-8');

    expect(second).not.toBe(first);
    expect(second.split(' ')[0]).toBe(first.split(' ')[0]);
  });

  it('removes bundles left by earlier versions', async () => {
    mkdirSync(join(installDir, '2608.29.0001'), { recursive: true });

    await updateManager.downloadAndExtractClientBundle(
      axiosServing(bundleTarball({ 'index.js': '' })),
      '2608.30.0002',
      'https://example.com/bundle.tar.gz'
    );

    expect(bundleDirs()).toEqual(['2608.30.0002']);
  });

  it('keeps the lock files when cleaning up old bundles', async () => {
    // A lock on a deleted file no longer excludes processes that reopen the
    // path, so cleanup must never unlink these.
    writeFileSync(join(installDir, 'verify.lock'), '123');
    mkdirSync(join(installDir, '2608.29.0001'), { recursive: true });

    await updateManager.downloadAndExtractClientBundle(
      axiosServing(bundleTarball({ 'index.js': '' })),
      '2608.30.0002',
      'https://example.com/bundle.tar.gz'
    );

    expect(existsSync(join(installDir, 'verify.lock'))).toBe(true);
    expect(existsSync(join(installDir, 'download.lock'))).toBe(true);
  });

  it('survives an entry it cannot stat while cleaning up old bundles', async () => {
    // A concurrent cleanup can unlink an entry between the readdir and the
    // stat. A broken symlink reproduces that failure deterministically.
    symlinkSync(join(installDir, 'gone'), join(installDir, '2608.29.0001'));

    const installed = await updateManager.downloadAndExtractClientBundle(
      axiosServing(bundleTarball({ 'index.js': '' })),
      '2608.30.0002',
      'https://example.com/bundle.tar.gz'
    );

    expect(installed.version).toBe('2608.30.0002');
  });

  it('leaves no bundle behind when the download request fails', async () => {
    await expect(
      updateManager.downloadAndExtractClientBundle(
        axiosFailing(new Error('connection reset')),
        '2608.30.0002',
        'https://example.com/bundle.tar.gz'
      )
    ).rejects.toThrow('connection reset');

    expect(bundleDirs()).toEqual([]);
  });

  it('does not clobber an installed bundle when a later download fails', async () => {
    await updateManager.downloadAndExtractClientBundle(
      axiosServing(bundleTarball({ 'index.js': 'good' })),
      '2608.30.0002',
      'https://example.com/bundle.tar.gz'
    );

    await expect(
      updateManager.downloadAndExtractClientBundle(
        axiosFailing(new Error('connection reset')),
        '2608.31.0001',
        'https://example.com/bundle.tar.gz'
      )
    ).rejects.toThrow('connection reset');

    expect(bundleDirs()).toEqual(['2608.30.0002']);
    expect(
      readFileSync(join(installDir, '2608.30.0002', 'index.js'), 'utf-8')
    ).toBe('good');
  });

  it('rejects rather than hanging when the response body is not a valid archive', async () => {
    await expect(
      updateManager.downloadAndExtractClientBundle(
        axiosServing(() => Readable.from([Buffer.from('not a gzip stream')])),
        '2608.30.0002',
        'https://example.com/bundle.tar.gz'
      )
    ).rejects.toThrow();

    expect(bundleDirs()).toEqual([]);
  });

  it('rejects rather than hanging when the download is truncated mid-stream', async () => {
    await expect(
      updateManager.downloadAndExtractClientBundle(
        axiosServing(() => {
          const stream = new Readable({ read() {} });
          process.nextTick(() => stream.destroy(new Error('socket hang up')));
          return stream;
        }),
        '2608.30.0002',
        'https://example.com/bundle.tar.gz'
      )
    ).rejects.toThrow();

    expect(bundleDirs()).toEqual([]);
  });
});

describe('update-manager download lock', () => {
  let workspace: string;
  let installDir: string;
  let updateManager: UpdateManager;
  let peers: ChildProcess[];

  beforeEach(async () => {
    workspace = mkdtempSync(join(tmpdir(), 'nx-update-manager-lock-'));
    writeFileSync(join(workspace, 'nx.json'), '{}');

    vi.resetModules();
    const { setWorkspaceRoot } = await import('../utils/workspace-root');
    setWorkspaceRoot(workspace);
    const { resetSharedRootCacheForTesting } =
      await import('../utils/cache-directory');
    resetSharedRootCacheForTesting();

    updateManager = await import('./update-manager');
    installDir = updateManager.getBundleInstallDefaultLocation();
    mkdirSync(installDir, { recursive: true });
    peers = [];
  });

  afterEach(() => {
    for (const peer of peers) peer.kill();
    rmSync(workspace, { recursive: true, force: true });
    rmSync(installDir, { recursive: true, force: true });
  });

  const bundleDirs = () =>
    readdirSync(installDir)
      .filter((f) => statSync(join(installDir, f)).isDirectory())
      .sort();

  /** Starts a peer holding the lock and resolves once it actually holds it. */
  async function startPeer(options: {
    version: string;
    holdMs: number;
    installs: boolean;
  }): Promise<void> {
    const script = join(workspace, 'peer.js');
    writeFileSync(script, PEER_SOURCE, 'utf-8');
    peers.push(
      spawn(
        process.execPath,
        [
          script,
          nativeBindings,
          installDir,
          options.version,
          String(options.holdMs),
          options.installs ? 'install' : 'fail',
        ],
        { stdio: 'ignore' }
      )
    );

    const flag = join(installDir, 'peer-holds.flag');
    for (let i = 0; i < 400 && !existsSync(flag); i++) await sleep(25);
    if (!existsSync(flag)) throw new Error('peer never took the lock');
  }

  it('adopts the bundle a peer installed when it is not older', async () => {
    const axios = axiosServing(bundleTarball({ 'index.js': 'mine' }));
    await startPeer({ version: '2608.31.0001', holdMs: 300, installs: true });

    const installed = await updateManager.downloadAndExtractClientBundle(
      axios,
      '2608.30.0002',
      'https://example.com/bundle.tar.gz'
    );

    expect(installed.version).toBe('2608.31.0001');
    expect(axios.get).not.toHaveBeenCalled();
    expect(readFileSync(join(installed.fullPath, 'index.js'), 'utf-8')).toBe(
      'peer bundle'
    );
  });

  it('downloads its own bundle when the peer installed an older one', async () => {
    const axios = axiosServing(bundleTarball({ 'index.js': 'mine' }));
    await startPeer({ version: '2608.29.0001', holdMs: 300, installs: true });

    const installed = await updateManager.downloadAndExtractClientBundle(
      axios,
      '2608.30.0002',
      'https://example.com/bundle.tar.gz'
    );

    expect(installed.version).toBe('2608.30.0002');
    expect(axios.get).toHaveBeenCalledOnce();
  });

  it('leaves the peer bundle in place on a contended install', async () => {
    // The peer is still running from 2608.29.0001; deleting it would break
    // that process's lazy requires. This is the original defect.
    await startPeer({ version: '2608.29.0001', holdMs: 300, installs: true });

    await updateManager.downloadAndExtractClientBundle(
      axiosServing(bundleTarball({ 'index.js': 'mine' })),
      '2608.30.0002',
      'https://example.com/bundle.tar.gz'
    );

    expect(bundleDirs()).toEqual(['2608.29.0001', '2608.30.0002']);
    expect(
      readFileSync(join(installDir, '2608.29.0001', 'index.js'), 'utf-8')
    ).toBe('peer bundle');
  });

  it('takes over the download when the peer released the lock without installing', async () => {
    mkdirSync(join(installDir, '2608.28.0001'), { recursive: true });
    const axios = axiosServing(bundleTarball({ 'index.js': 'mine' }));
    await startPeer({ version: '2608.31.0001', holdMs: 300, installs: false });

    const installed = await updateManager.downloadAndExtractClientBundle(
      axios,
      '2608.30.0002',
      'https://example.com/bundle.tar.gz'
    );

    expect(installed.version).toBe('2608.30.0002');
    expect(axios.get).toHaveBeenCalledOnce();
    // Uncontended, so the stale bundle is cleaned up as usual.
    expect(bundleDirs()).toEqual(['2608.30.0002']);
  });

  it('waits for the peer rather than racing it', async () => {
    const axios = axiosServing(bundleTarball({ 'index.js': 'mine' }));
    await startPeer({ version: '2608.31.0001', holdMs: 600, installs: true });

    const start = Date.now();
    await updateManager.downloadAndExtractClientBundle(
      axios,
      '2608.30.0002',
      'https://example.com/bundle.tar.gz'
    );

    expect(Date.now() - start).toBeGreaterThanOrEqual(400);
  });
});
