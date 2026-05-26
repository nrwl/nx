import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { TempFs } from '../../internal-testing-utils/temp-fs';

describe('getCachedSerializedProjectGraphPromise — watcher race coverage', () => {
  let fs: TempFs;

  beforeEach(() => {
    fs = new TempFs('pgir-race');
  });

  afterEach(() => {
    fs.cleanup();
  });

  // Reproduces the spread-test flake shape end-to-end: write a new
  // project.json then immediately request the graph with no awaits
  // in between. If the daemon serves a stale cache, the new project
  // won't appear in the response — that's the bug. With the fix in
  // place the watcher pipeline delivers the event in time.
  //
  // jest.isolateModulesAsync is required: cache-directory.ts evaluates
  // workspaceDataDirectory as a `const` at module load, so without a
  // fresh module graph the daemon would write its cache into the real
  // workspace under test.
  it('returns a fresh graph reflecting an in-flight project add', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'root' }),
    });

    await jest.isolateModulesAsync(async () => {
      const { setWorkspaceRoot } = require('../../utils/workspace-root');
      setWorkspaceRoot(fs.tempDir);

      const { watchWorkspace } = require('./watcher');
      const { storeWatcherInstance } = require('./shutdown-utils');
      const {
        getCachedSerializedProjectGraphPromise,
      } = require('./project-graph-incremental-recomputation');
      const {
        routeWorkspaceChanges,
      } = require('./file-watching/route-workspace-changes');

      const fakeServer = {} as unknown as import('net').Server;
      const watcher = await watchWorkspace(
        fakeServer,
        async (err: unknown, events: { type: string; path: string }[]) => {
          if (err || !events) return;
          routeWorkspaceChanges(events);
        }
      );
      storeWatcherInstance(watcher);

      try {
        // First request — graph has no 'foo' project.
        const first = await getCachedSerializedProjectGraphPromise();
        expect(first.projectGraph?.nodes?.foo).toBeUndefined();

        // Add a project on disk and IMMEDIATELY request the graph —
        // no awaits, no sleeps. The watcher pipeline has to deliver
        // this event in time for the next compute to see it.
        mkdirSync(join(fs.tempDir, 'libs', 'foo'), { recursive: true });
        writeFileSync(
          join(fs.tempDir, 'libs', 'foo', 'project.json'),
          JSON.stringify({ name: 'foo', root: 'libs/foo' })
        );
        const second = await getCachedSerializedProjectGraphPromise();

        // The smoking gun. Without the fix, the watcher event could
        // be missed and the daemon would re-serve the first graph
        // (no 'foo').
        expect(second.projectGraph?.nodes?.foo).toBeDefined();
        expect(second.projectGraph?.nodes?.foo?.data?.root).toBe('libs/foo');
      } finally {
        await watcher.stop();
      }
    });
  });

  // Covers the freshness-gate path inside kickOffRecompute: if nx.json's
  // `plugins` field changes between kickoff and commit, the in-flight
  // IIFE must discard its result (built against the older plugin set)
  // and let a successor recompute against the new disk state. Without
  // the gate, cachedSerializedProjectGraphPromise was last-kickoff-wins
  // and could return a stale graph (see spread.test.ts middle-plugin
  // flake).
  //
  // Mocks getPluginsSeparated only to park the first IIFE between its
  // synchronous hash snapshot and its commit — that gap is the window
  // the bug lives in. The mock controls timing, not logic; the real
  // gate + real currentNxJsonPluginsHash run.
  it('discards stale recompute when nx.json plugins change mid-compute', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({ plugins: ['./tools/plugin-a'] }),
      'package.json': JSON.stringify({ name: 'root' }),
    });

    await jest.isolateModulesAsync(async () => {
      const { setWorkspaceRoot } = require('../../utils/workspace-root');
      setWorkspaceRoot(fs.tempDir);

      // Park the first IIFE between its synchronous hash snapshot and
      // its commit — that gap is the bug window. Real getPluginsSeparated
      // resolves too fast to rewrite nx.json in between, so we gate it
      // here to control timing only.
      let resolveFirstPlugins: () => void;
      const firstPluginsGate = new Promise<void>((resolve) => {
        resolveFirstPlugins = resolve;
      });
      let pluginsCallCount = 0;
      jest.doMock('../../project-graph/plugins/get-plugins', () => ({
        __esModule: true,
        getPlugins: jest.fn(async () => []),
        getPluginsSeparated: jest.fn(async () => {
          pluginsCallCount++;
          if (pluginsCallCount === 1) {
            await firstPluginsGate;
          }
          return { specifiedPlugins: [], defaultPlugins: [] };
        }),
      }));

      const { serverLogger } = require('../logger');
      const logSpy = jest.spyOn(serverLogger, 'log');

      const {
        scheduleProjectGraphRecomputation,
        getCachedSerializedProjectGraphPromise,
      } = require('./project-graph-incremental-recomputation');

      // Kick off compute #1 — snapshot captured synchronously here.
      scheduleProjectGraphRecomputation([], ['__trigger.txt'], []);

      // Rewrite nx.json so disk diverges from the snapshot. The IIFE is
      // still parked on firstPluginsGate, so it hasn't yet read plugins.
      writeFileSync(
        join(fs.tempDir, 'nx.json'),
        JSON.stringify({ plugins: ['./tools/plugin-b'] })
      );

      // Let compute #1 proceed. It computes, hits the gate, sees disk
      // hash != snapshot hash, logs the discard, and kicks a successor.
      resolveFirstPlugins!();

      await getCachedSerializedProjectGraphPromise();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Discarding stale recompute result')
      );
      // First IIFE bailed → kicked successor → at least two getPlugins calls.
      expect(pluginsCallCount).toBeGreaterThanOrEqual(2);
    });
  });
});
