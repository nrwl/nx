import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

import { TempFs } from '../../internal-testing-utils/temp-fs';

describe('getCachedSerializedProjectGraphPromise — watcher race coverage', () => {
  let fs: TempFs;

  beforeEach(() => {
    fs = new TempFs('pgir-race');
  });

  afterEach(() => {
    fs.cleanup();
  });

  // Reproduces the spread-test flake shape end-to-end. Real native
  // Watcher, real production callback that routes events into
  // `collected*` via `scheduleProjectGraphRecomputation`. The test
  // writes nx.json and IMMEDIATELY makes the next request — no
  // sleeps, no awaits in between — so the watcher pipeline has to
  // either deliver the event before the request is served or the
  // daemon serves stale.
  //
  // On master (no fixes): this test is flaky because the watcher
  // pipeline can lose the race (notify thread mid-send, callback
  // queued behind the request handler).
  //
  // With `setImmediate` in `flushPendingWorkspaceChanges` and
  // `recv_timeout(5ms)` in the native force-flush handler, both
  // race windows close and the test is deterministic.
  it('catches a write that lands just before the next request', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({ plugins: [] }),
      'package.json': JSON.stringify({ name: 'root' }),
    });

    await jest.isolateModulesAsync(async () => {
      const { setWorkspaceRoot } = require('../../utils/workspace-root');
      setWorkspaceRoot(fs.tempDir);

      const { watchWorkspace } = require('./watcher');
      const { storeWatcherInstance } = require('./shutdown-utils');
      const {
        getCachedSerializedProjectGraphPromise,
        scheduleProjectGraphRecomputation,
      } = require('./project-graph-incremental-recomputation');
      const { serverLogger } = require('../logger');

      // Mirror the production callback (`handleWorkspaceChanges` in
      // server.ts) — categorise events and route them into the
      // recomputation queue. Anything less than this would mean we're
      // testing the daemon with a watcher that doesn't actually drive
      // the real `collected*` state.
      const fakeServer = {} as unknown as import('net').Server;
      const watcher = await watchWorkspace(
        fakeServer,
        async (err: unknown, events: { type: string; path: string }[]) => {
          if (err || !events) return;
          const created: string[] = [];
          const updated: string[] = [];
          const deleted: string[] = [];
          for (const e of events) {
            if (e.type === 'delete') deleted.push(e.path);
            else if (e.type === 'update') updated.push(e.path);
            else created.push(e.path);
          }
          scheduleProjectGraphRecomputation(created, updated, deleted);
        }
      );
      storeWatcherInstance(watcher);

      try {
        // First request — cold compute, populates the in-memory cache.
        await getCachedSerializedProjectGraphPromise();

        const logSpy = jest.spyOn(serverLogger, 'log');

        // Tight race: write the file and immediately request — no
        // awaits between them. This is the same shape as the spread
        // test's `updateJson(nx.json)` followed by the next CLI call.
        // Mutate a benign field so the recompute can complete (a bad
        // plugin spec would throw and obscure the assertion).
        writeFileSync(
          join(fs.tempDir, 'nx.json'),
          JSON.stringify({ plugins: [], affected: { defaultBase: 'main' } })
        );
        await getCachedSerializedProjectGraphPromise();

        const messages = logSpy.mock.calls.map((c) => String(c[0]));
        const recomputed = messages.some((m) =>
          /Recomputing project graph/.test(m)
        );
        const reused = messages.some((m) =>
          /Reusing in-memory cached project graph/.test(m)
        );

        // Whichever mechanism catches it (watcher event → collected*,
        // or drift, or anything else), what matters is the daemon
        // does NOT serve the stale cache.
        expect(reused).toBe(false);
        expect(recomputed).toBe(true);
      } finally {
        await watcher.stop();
      }
    });
  });
});
