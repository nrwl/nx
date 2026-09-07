import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Watcher, WorkspaceContext, WatchEvent } from '../index';

// The daemon boots by starting the file watcher and then scanning the
// workspace (see startServer). These tests pin the interleaving that
// ordering relies on: a write landing after watch() returns is always
// reported, while a write landing after a completed scan but before
// watch() is invisible to both — the boot blind window behind the
// "Cannot find project" e2e flakes.
describe('watch-before-scan boot ordering', () => {
  let workspace: string;
  let cacheDir: string;
  let watcher: Watcher | undefined;
  const captured: WatchEvent[] = [];

  beforeEach(() => {
    workspace = realpathSync(mkdtempSync(join(tmpdir(), 'nx-watch-scan-')));
    // Seed file: FilesWorker's condvar treats an empty file list as
    // "scan not finished", so allFileData on an empty workspace hangs.
    writeFileSync(join(workspace, 'seed.txt'), 'x');
    // Cache lives outside the workspace so context bookkeeping files
    // cannot generate watcher events or show up in the scan.
    cacheDir = mkdtempSync(join(tmpdir(), 'nx-watch-scan-cache-'));
    captured.length = 0;
  });

  afterEach(async () => {
    await watcher?.stop();
    watcher = undefined;
    rmSync(workspace, { recursive: true, force: true });
    rmSync(cacheDir, { recursive: true, force: true });
  });

  function startWatcher() {
    watcher = new Watcher(workspace, null, false);
    watcher.watch((err, events) => {
      if (!err) {
        captured.push(...events);
      }
    });
  }

  async function watcherReported(
    path: string,
    timeoutMs: number
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (
        captured.some((e) => e.path === path) ||
        watcher.forceFlushPending().some((e) => e.path === path)
      ) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  }

  it('reports a write that lands immediately after watch() returns, before any scan', async () => {
    startWatcher();
    writeFileSync(join(workspace, 'boot.txt'), 'x');

    expect(await watcherReported('boot.txt', 4000)).toBe(true);

    const context = new WorkspaceContext(workspace, cacheDir);
    expect(context.allFileData().map((f) => f.file)).toContain('boot.txt');
  });

  it('loses a write that lands between a completed scan and watch() (the blind window)', async () => {
    const context = new WorkspaceContext(workspace, cacheDir);
    expect(context.allFileData().map((f) => f.file)).not.toContain('late.txt');

    writeFileSync(join(workspace, 'late.txt'), 'x');
    startWatcher();

    // Registered after the write: the watcher never reports it, and the
    // scan snapshot predates it. This is the daemon's former boot order.
    expect(await watcherReported('late.txt', 1000)).toBe(false);
    expect(context.allFileData().map((f) => f.file)).not.toContain('late.txt');
  });
});
