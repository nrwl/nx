import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { TempFs } from '../../internal-testing-utils/temp-fs';

// Loading the module under test pulls in the daemon server (via ./watcher),
// which registers a process-global PerformanceObserver. That observer outlives
// each test's isolated module registry, so a measure emitted by the last real
// compute would dispatch after teardown and its lazy requires would throw.
vi.mock('../../utils/perf-logging', () => ({}));

// These cases drive a real compute, so they need working plugin-worker
// isolation. Where forked workers cannot start (containers, agent sandboxes)
// every case stalls to the suite timeout; run with NX_ISOLATE_PLUGINS=false.
// The first case additionally needs real watcher event delivery, which a
// container filesystem does not provide, and fails there either way.
describe('getCachedSerializedProjectGraphPromise — watcher race coverage', () => {
  let fs: TempFs;

  beforeEach(() => {
    fs = new TempFs('pgir-race');
  });

  afterEach(() => {
    fs.cleanup();
  });

  // Reproduces the spread-test flake shape end-to-end: write a new
  // project.json, then poll the graph until the watcher event lands. If the
  // daemon serves a stale cache the project never appears and the poll
  // exhausts — that's the bug. Note this proves eventual delivery, not
  // delivery before the next compute: a regression that merely delays the
  // event passes here.
  //
  // vi.resetModules + fresh imports are required: cache-directory.ts evaluates
  // workspaceDataDirectory as a `const` at module load, so without a
  // fresh module graph the daemon would write its cache into the real
  // workspace under test.
  // Own timeout: the first graph compute alone runs 10-20s, so the default
  // leaves no room for the poll and the test dies by timeout, not assertion.
  it('returns a fresh graph reflecting an in-flight project add', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'root' }),
    });

    vi.resetModules();
    const { setWorkspaceRoot } = await import('../../utils/workspace-root');
    setWorkspaceRoot(fs.tempDir);

    const { watchWorkspace } = await import('./watcher');
    const { storeWatcherInstance } = await import('./shutdown-utils');
    const { getCachedSerializedProjectGraphPromise } =
      await import('./project-graph-incremental-recomputation');
    const { routeWorkspaceChanges } =
      await import('./file-watching/route-workspace-changes');

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

      // Add a project on disk and request the graph. The watcher pipeline has
      // to deliver this event; poll instead of demanding it lands before the
      // very next compute, which CPU contention alone can delay. A dropped
      // event never surfaces the project, so the regression still fails here.
      mkdirSync(join(fs.tempDir, 'libs', 'foo'), { recursive: true });
      writeFileSync(
        join(fs.tempDir, 'libs', 'foo', 'project.json'),
        JSON.stringify({ name: 'foo', root: 'libs/foo' })
      );
      let second = await getCachedSerializedProjectGraphPromise();
      const deadline = Date.now() + 10_000;
      while (!second.projectGraph?.nodes?.foo && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        second = await getCachedSerializedProjectGraphPromise();
      }

      // The smoking gun. Without the fix, the watcher event could
      // be missed and the daemon would re-serve the first graph
      // (no 'foo').
      expect(second.projectGraph?.nodes?.foo).toBeDefined();
      expect(second.projectGraph?.nodes?.foo?.data?.root).toBe('libs/foo');
    } finally {
      await watcher.stop();
    }
  }, 60_000);

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

    vi.resetModules();
    const { setWorkspaceRoot } = await import('../../utils/workspace-root');
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
    vi.doMock('../../project-graph/plugins/get-plugins', () => ({
      __esModule: true,
      getPlugins: vi.fn(async () => []),
      getPluginsSeparated: vi.fn(async () => {
        pluginsCallCount++;
        if (pluginsCallCount === 1) {
          await firstPluginsGate;
        }
        return { specifiedPlugins: [], defaultPlugins: [] };
      }),
    }));

    const { serverLogger } = await import('../logger');
    const logSpy = vi.spyOn(serverLogger, 'log');

    const {
      scheduleProjectGraphRecomputation,
      getCachedSerializedProjectGraphPromise,
    } = await import('./project-graph-incremental-recomputation');

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

  // kickOffRecompute() runs fire-and-forget, so a rejecting prologue used to
  // crash the daemon with an unhandled rejection. A requester's own try/catch
  // hides that, so the only observable distinguishing fixed from broken is
  // whether the orphaned promise rejects unhandled — hence the process listener.
  it('keeps the daemon alive when a recompute plugin load rejects', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({ plugins: ['./tools/plugin-a'] }),
      'package.json': JSON.stringify({ name: 'root' }),
    });

    vi.resetModules();
    const { setWorkspaceRoot } = await import('../../utils/workspace-root');
    setWorkspaceRoot(fs.tempDir);

    const pluginLoadError = new Error('plugin boom');
    let pluginsCallCount = 0;
    vi.doMock('../../project-graph/plugins/get-plugins', () => ({
      __esModule: true,
      getPlugins: vi.fn(async () => []),
      getPluginsSeparated: vi.fn(async () => {
        pluginsCallCount++;
        throw pluginLoadError;
      }),
    }));

    const {
      scheduleProjectGraphRecomputation,
      getCachedSerializedProjectGraphPromise,
    } = await import('./project-graph-incremental-recomputation');

    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);

    try {
      // Fire-and-forget kickoff — nobody awaits the stored promise.
      scheduleProjectGraphRecomputation([], ['__trigger.txt'], []);

      // Let the IIFE reject and give Node room to flag an unhandled rejection.
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));

      // Without the fix this orphaned rejection is unhandled — the crash.
      expect(
        unhandled.filter(
          (r) =>
            r === pluginLoadError ||
            (r instanceof Error && r.message.includes('plugin boom'))
        )
      ).toEqual([]);

      // A requester gets an errorResult, not a throw.
      const result = await getCachedSerializedProjectGraphPromise();
      expect(result.projectGraph).toBeNull();
      expect(result.error).toBeDefined();

      // Errored result clears the cache, so the next request retries.
      const callsBeforeRetry = pluginsCallCount;
      await getCachedSerializedProjectGraphPromise();
      expect(pluginsCallCount).toBeGreaterThan(callsBeforeRetry);
    } finally {
      process.removeListener('unhandledRejection', onUnhandled);
    }
  });
});

describe('isKnownWorkspaceFile', () => {
  let fs: TempFs;

  beforeEach(() => {
    fs = new TempFs('pgir-known-files');
  });

  afterEach(() => {
    fs.cleanup();
  });

  it('answers membership from the committed ignore-filtered file map', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'root' }),
      '.nxignore': '.env\n',
      '.env': 'A=1\n',
      'libs/foo/project.json': JSON.stringify({
        name: 'foo',
        root: 'libs/foo',
      }),
      'libs/foo/src/index.ts': '',
    });

    vi.resetModules();
    // The plugin-loader mocks vi.doMock installs in the tests above are
    // registry-wide and outlive vi.resetModules.
    vi.doUnmock('../../project-graph/plugins/get-plugins');
    const { setWorkspaceRoot } = await import('../../utils/workspace-root');
    setWorkspaceRoot(fs.tempDir);

    const {
      getCachedSerializedProjectGraphPromise,
      scheduleProjectGraphRecomputation,
      isKnownWorkspaceFile,
    } = await import('./project-graph-incremental-recomputation');

    // Nothing is known before the first recompute commits a map; the caller
    // (server.ts) then fails safe by invalidating.
    expect(isKnownWorkspaceFile('package.json')).toBe(false);

    const committed = await getCachedSerializedProjectGraphPromise();
    expect(committed.error).toBeNull();

    expect(isKnownWorkspaceFile('package.json')).toBe(true);
    expect(isKnownWorkspaceFile('libs/foo/src/index.ts')).toBe(true);
    // Ignored, so filtered out of the map (and never watched).
    expect(isKnownWorkspaceFile('.env')).toBe(false);
    expect(isKnownWorkspaceFile('never-existed.env')).toBe(false);

    // A later commit replaces the map; membership must follow the new map,
    // not a lookup structure built from the old one.
    fs.createFileSync('libs/foo/src/other.ts', '');
    scheduleProjectGraphRecomputation(['libs/foo/src/other.ts'], [], []);
    await getCachedSerializedProjectGraphPromise();
    expect(isKnownWorkspaceFile('libs/foo/src/other.ts')).toBe(true);
  });
});

describe('invalidateGraphCache', () => {
  let fs: TempFs;

  beforeEach(() => {
    fs = new TempFs('pgir-invalidate');
  });

  afterEach(() => {
    fs.cleanup();
  });

  // The generation bump is what chains an in-flight compute to a successor:
  // clearing the cached promise alone lets the compute pass its chainToLatest
  // checks and hand its result — built under the pre-invalidation input — to
  // whoever already awaits it, with no successor ever started.
  it('chains an in-flight compute to a successor instead of serving its result', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'root' }),
    });

    vi.resetModules();
    // The plugin-loader mocks vi.doMock installs in the tests above are
    // registry-wide and outlive vi.resetModules.
    vi.doUnmock('../../project-graph/plugins/get-plugins');
    const { setWorkspaceRoot } = await import('../../utils/workspace-root');
    setWorkspaceRoot(fs.tempDir);

    // Park the first compute inside its config retrieval, after it claimed
    // its generation — the window an env-carrying client message can land
    // in. The mock controls timing, not logic; the real retrieval runs.
    let releaseFirstRetrieve: () => void;
    const firstRetrieveGate = new Promise<void>((resolve) => {
      releaseFirstRetrieve = resolve;
    });
    let retrieveCallCount = 0;
    vi.doMock(
      '../../project-graph/utils/retrieve-workspace-files',
      async () => {
        const actual = (await vi.importActual(
          '../../project-graph/utils/retrieve-workspace-files'
        )) as any;
        return {
          ...actual,
          retrieveProjectConfigurations: async (...args: unknown[]) => {
            retrieveCallCount++;
            if (retrieveCallCount === 1) {
              await firstRetrieveGate;
            }
            return actual.retrieveProjectConfigurations(...args);
          },
        };
      }
    );

    const { getCachedSerializedProjectGraphPromise, invalidateGraphCache } =
      await import('./project-graph-incremental-recomputation');

    const first = getCachedSerializedProjectGraphPromise();
    while (retrieveCallCount === 0) {
      await new Promise((r) => setImmediate(r));
    }

    invalidateGraphCache();
    releaseFirstRetrieve!();

    const result = await first;
    expect(result.error).toBeNull();
    expect(result.projectGraph).toBeDefined();
    // The successor's retrieval, proving the parked compute discarded its
    // own result and chained instead of committing.
    expect(retrieveCallCount).toBeGreaterThanOrEqual(2);
  });
});

describe('pending dotenv replay before serving a graph', () => {
  let fs: TempFs;

  beforeEach(() => {
    fs = new TempFs('pgir-dotenv-replay');
  });

  afterEach(() => {
    fs.cleanup();
  });

  // A gitignored project-root dotenv edit arriving while the initial
  // computation is in flight matches no committed root, so it is queued
  // rather than invalidating. The compute must replay the queue against the
  // graph it is about to serve and chain every awaiting caller to a successor
  // that reads the new content; committing instead would serve, notify, and
  // persist config derived from the old file.
  it('chains the first awaiting caller to a successor that observes the dotenv edit', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'root' }),
      '.gitignore': '.env.e2e\n',
      'libs/foo/project.json': JSON.stringify({
        name: 'foo',
        root: 'libs/foo',
      }),
      'libs/foo/.env.e2e': 'PORT=4200\n',
    });

    vi.resetModules();
    // The plugin-loader mocks vi.doMock installs in the tests above are
    // registry-wide and outlive vi.resetModules.
    vi.doUnmock('../../project-graph/plugins/get-plugins');
    const { setWorkspaceRoot } = await import('../../utils/workspace-root');
    setWorkspaceRoot(fs.tempDir);

    // Park the first compute after its config retrieval read the old dotenv
    // content — the window the edit lands in. The injected tag stands in
    // for a plugin resolving config from the dotenv file at createNodes
    // time; the mock controls timing and the marker, not the retrieval.
    let releaseFirstRetrieve: () => void;
    const firstRetrieveGate = new Promise<void>((resolve) => {
      releaseFirstRetrieve = resolve;
    });
    let firstRetrieveDone = false;
    let retrieveCallCount = 0;
    vi.doMock(
      '../../project-graph/utils/retrieve-workspace-files',
      async () => {
        const actual = (await vi.importActual(
          '../../project-graph/utils/retrieve-workspace-files'
        )) as any;
        return {
          ...actual,
          retrieveProjectConfigurations: async (...args: unknown[]) => {
            const call = ++retrieveCallCount;
            const result = await actual.retrieveProjectConfigurations(...args);
            const env = readFileSync(
              join(fs.tempDir, 'libs/foo/.env.e2e'),
              'utf-8'
            ).trim();
            result.projects['libs/foo'].tags = [`env:${env}`];
            if (call === 1) {
              firstRetrieveDone = true;
              await firstRetrieveGate;
            }
            return result;
          },
        };
      }
    );

    const {
      getCachedSerializedProjectGraphPromise,
      registerProjectGraphRecomputationListener,
    } = await import('./project-graph-incremental-recomputation');
    const { handleOutputsChanges } = await import('./handle-outputs-changes');
    const { nxProjectGraph } =
      await import('../../project-graph/nx-deps-cache');
    const { EventType } = await import('../../native');

    const notifiedTags: string[][] = [];
    registerProjectGraphRecomputationListener(
      (graph: import('../../config/project-graph').ProjectGraph) => {
        notifiedTags.push(graph.nodes.foo.data.tags);
      }
    );

    const first = getCachedSerializedProjectGraphPromise();
    while (!firstRetrieveDone) {
      await new Promise((r) => setImmediate(r));
    }

    writeFileSync(join(fs.tempDir, 'libs/foo/.env.e2e'), 'PORT=4201\n');
    // The outputs watcher is the only reporter of gitignored files. No
    // graph is committed yet, so the event goes unclassified and is queued.
    await handleOutputsChanges(null, [
      { path: 'libs/foo/.env.e2e', type: EventType.update },
    ]);
    releaseFirstRetrieve!();

    const result = await first;
    expect(result.error).toBeNull();
    expect(result.projectGraph.nodes.foo.data.tags).toEqual(['env:PORT=4201']);
    // The successor's retrieval, proving the first compute did not serve
    // the graph built from the old content.
    expect(retrieveCallCount).toBeGreaterThanOrEqual(2);
    // The stale graph must be neither notified to listeners nor persisted.
    expect(notifiedTags).toEqual([['env:PORT=4201']]);
    const persisted = readFileSync(nxProjectGraph, 'utf-8');
    expect(persisted).toContain('PORT=4201');
    expect(persisted).not.toContain('PORT=4200');
  });

  // The successor itself can read intermediate bytes the watcher never
  // reports separately: the file changes again mid-successor and returns to
  // the drain-time bytes before the coalesced event arrives. A content hash
  // recorded at drain time would suppress that final event and let the
  // successor serve the intermediate content, so the drain must not record
  // hashes.
  it('recomputes for a post-drain edit whose final bytes match the drain-time content', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'root' }),
      '.gitignore': '.env.e2e\n',
      'libs/foo/project.json': JSON.stringify({
        name: 'foo',
        root: 'libs/foo',
      }),
      'libs/foo/.env.e2e': 'PORT=4200\n',
    });

    vi.resetModules();
    // The plugin-loader mocks vi.doMock installs in the tests above are
    // registry-wide and outlive vi.resetModules.
    vi.doUnmock('../../project-graph/plugins/get-plugins');
    const { setWorkspaceRoot } = await import('../../utils/workspace-root');
    setWorkspaceRoot(fs.tempDir);

    const makeGate = () => {
      let release: () => void;
      const promise = new Promise<void>((resolve) => {
        release = resolve;
      });
      return { promise, release: () => release(), reached: false };
    };
    // Park compute A after its read, compute B before and after its read,
    // so edits land in each window; compute C runs unimpeded.
    const aExit = makeGate();
    const bEntry = makeGate();
    const bExit = makeGate();
    let retrieveCallCount = 0;
    vi.doMock(
      '../../project-graph/utils/retrieve-workspace-files',
      async () => {
        const actual = (await vi.importActual(
          '../../project-graph/utils/retrieve-workspace-files'
        )) as any;
        return {
          ...actual,
          retrieveProjectConfigurations: async (...args: unknown[]) => {
            const call = ++retrieveCallCount;
            if (call === 2) {
              bEntry.reached = true;
              await bEntry.promise;
            }
            const result = await actual.retrieveProjectConfigurations(...args);
            const env = readFileSync(
              join(fs.tempDir, 'libs/foo/.env.e2e'),
              'utf-8'
            ).trim();
            result.projects['libs/foo'].tags = [`env:${env}`];
            if (call === 1) {
              aExit.reached = true;
              await aExit.promise;
            }
            if (call === 2) {
              bExit.reached = true;
              await bExit.promise;
            }
            return result;
          },
        };
      }
    );

    const {
      getCachedSerializedProjectGraphPromise,
      registerProjectGraphRecomputationListener,
    } = await import('./project-graph-incremental-recomputation');
    const { handleOutputsChanges } = await import('./handle-outputs-changes');
    const { nxProjectGraph } =
      await import('../../project-graph/nx-deps-cache');
    const { EventType } = await import('../../native');

    const notifiedTags: string[][] = [];
    registerProjectGraphRecomputationListener(
      (graph: import('../../config/project-graph').ProjectGraph) => {
        notifiedTags.push(graph.nodes.foo.data.tags);
      }
    );

    const waitFor = async (cond: () => boolean) => {
      while (!cond()) {
        await new Promise((r) => setImmediate(r));
      }
    };
    const envPath = join(fs.tempDir, 'libs/foo/.env.e2e');
    const envEvent = { path: 'libs/foo/.env.e2e', type: EventType.update };

    // Compute A reads 4200 and parks; the edit to 4201 is queued.
    const first = getCachedSerializedProjectGraphPromise();
    await waitFor(() => aExit.reached);
    writeFileSync(envPath, 'PORT=4201\n');
    await handleOutputsChanges(null, [envEvent]);
    aExit.release();

    // A's drain chains to compute B, which reads an intermediate 4202
    // whose write the watcher never reports.
    await waitFor(() => bEntry.reached);
    writeFileSync(envPath, 'PORT=4202\n');
    bEntry.release();
    await waitFor(() => bExit.reached);

    // Back to the drain-time bytes; this event is B's only chance to be
    // marked stale, and A committed a graph so it classifies directly.
    writeFileSync(envPath, 'PORT=4201\n');
    await handleOutputsChanges(null, [envEvent]);
    bExit.release();

    const result = await first;
    expect(result.error).toBeNull();
    expect(result.projectGraph.nodes.foo.data.tags).toEqual(['env:PORT=4201']);
    expect(retrieveCallCount).toBeGreaterThanOrEqual(3);
    expect(notifiedTags).toEqual([['env:PORT=4201']]);
    const persisted = readFileSync(nxProjectGraph, 'utf-8');
    expect(persisted).toContain('PORT=4201');
    expect(persisted).not.toContain('PORT=4200');
    expect(persisted).not.toContain('PORT=4202');
  });

  // The outputs and workspace watchers deliver independently, so an edit to a
  // NON-ignored dotenv file can reach the outputs callback first and sit in
  // the pending queue while the workspace watcher has not scheduled anything
  // yet. The drain must treat the queued evidence as decisive: membership in
  // the file map proves the workspace watcher tracks the file, not that its
  // recomputation was already scheduled.
  it('chains for a queued edit of a tracked dotenv file the workspace watcher has not delivered yet', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'root' }),
      'libs/foo/project.json': JSON.stringify({
        name: 'foo',
        root: 'libs/foo',
      }),
      'libs/foo/.env.e2e': 'PORT=4200\n',
    });

    vi.resetModules();
    // The plugin-loader mocks vi.doMock installs in the tests above are
    // registry-wide and outlive vi.resetModules.
    vi.doUnmock('../../project-graph/plugins/get-plugins');
    const { setWorkspaceRoot } = await import('../../utils/workspace-root');
    setWorkspaceRoot(fs.tempDir);

    let releaseFirstRetrieve: () => void;
    const firstRetrieveGate = new Promise<void>((resolve) => {
      releaseFirstRetrieve = resolve;
    });
    let firstRetrieveDone = false;
    let retrieveCallCount = 0;
    vi.doMock(
      '../../project-graph/utils/retrieve-workspace-files',
      async () => {
        const actual = (await vi.importActual(
          '../../project-graph/utils/retrieve-workspace-files'
        )) as any;
        return {
          ...actual,
          retrieveProjectConfigurations: async (...args: unknown[]) => {
            const call = ++retrieveCallCount;
            const result = await actual.retrieveProjectConfigurations(...args);
            const env = readFileSync(
              join(fs.tempDir, 'libs/foo/.env.e2e'),
              'utf-8'
            ).trim();
            result.projects['libs/foo'].tags = [`env:${env}`];
            if (call === 1) {
              firstRetrieveDone = true;
              await firstRetrieveGate;
            }
            return result;
          },
        };
      }
    );

    const { getCachedSerializedProjectGraphPromise } =
      await import('./project-graph-incremental-recomputation');
    const { handleOutputsChanges } = await import('./handle-outputs-changes');
    const { EventType } = await import('../../native');

    const first = getCachedSerializedProjectGraphPromise();
    while (!firstRetrieveDone) {
      await new Promise((r) => setImmediate(r));
    }

    writeFileSync(join(fs.tempDir, 'libs/foo/.env.e2e'), 'PORT=4201\n');
    // Only the outputs watcher delivers; the workspace watcher is silent.
    await handleOutputsChanges(null, [
      { path: 'libs/foo/.env.e2e', type: EventType.update },
    ]);
    releaseFirstRetrieve!();

    const result = await first;
    expect(result.error).toBeNull();
    expect(result.projectGraph.nodes.foo.data.tags).toEqual(['env:PORT=4201']);
    expect(retrieveCallCount).toBeGreaterThanOrEqual(2);
  });

  // Once a computation has committed a graph and the file map, a tracked
  // dotenv edit classifies as invalidating on arrival, and the arrival path
  // defers to the workspace watcher instead of invalidating. That deferral is
  // only sound for the cached graph: a successor already in flight may have
  // read the file before the edit, so the event must be queued for its
  // pre-serve replay rather than dropped.
  it('chains when a tracked dotenv edit is classified while a successor is in flight', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'root' }),
      'libs/foo/project.json': JSON.stringify({
        name: 'foo',
        root: 'libs/foo',
      }),
      'libs/foo/.env.e2e': 'PORT=4200\n',
    });

    vi.resetModules();
    // The plugin-loader mocks vi.doMock installs in the tests above are
    // registry-wide and outlive vi.resetModules.
    vi.doUnmock('../../project-graph/plugins/get-plugins');
    const { setWorkspaceRoot } = await import('../../utils/workspace-root');
    setWorkspaceRoot(fs.tempDir);

    const makeGate = () => {
      let release: () => void;
      const promise = new Promise<void>((resolve) => {
        release = resolve;
      });
      return { promise, release: () => release(), reached: false };
    };
    // Park computes A and B after their reads so an edit lands in each
    // window; compute C runs unimpeded.
    const aExit = makeGate();
    const bExit = makeGate();
    let retrieveCallCount = 0;
    vi.doMock(
      '../../project-graph/utils/retrieve-workspace-files',
      async () => {
        const actual = (await vi.importActual(
          '../../project-graph/utils/retrieve-workspace-files'
        )) as any;
        return {
          ...actual,
          retrieveProjectConfigurations: async (...args: unknown[]) => {
            const call = ++retrieveCallCount;
            const result = await actual.retrieveProjectConfigurations(...args);
            const env = readFileSync(
              join(fs.tempDir, 'libs/foo/.env.e2e'),
              'utf-8'
            ).trim();
            result.projects['libs/foo'].tags = [`env:${env}`];
            if (call === 1) {
              aExit.reached = true;
              await aExit.promise;
            }
            if (call === 2) {
              bExit.reached = true;
              await bExit.promise;
            }
            return result;
          },
        };
      }
    );

    const {
      getCachedSerializedProjectGraphPromise,
      registerProjectGraphRecomputationListener,
    } = await import('./project-graph-incremental-recomputation');
    const { handleOutputsChanges } = await import('./handle-outputs-changes');
    const { nxProjectGraph } =
      await import('../../project-graph/nx-deps-cache');
    const { EventType } = await import('../../native');

    const notifiedTags: string[][] = [];
    registerProjectGraphRecomputationListener(
      (graph: import('../../config/project-graph').ProjectGraph) => {
        notifiedTags.push(graph.nodes.foo.data.tags);
      }
    );

    const waitFor = async (cond: () => boolean) => {
      while (!cond()) {
        await new Promise((r) => setImmediate(r));
      }
    };
    const envPath = join(fs.tempDir, 'libs/foo/.env.e2e');
    const envEvent = { path: 'libs/foo/.env.e2e', type: EventType.update };

    // Compute A reads 4200 and parks; no graph is committed yet, so the
    // edit to 4201 goes unclassified and is queued.
    const first = getCachedSerializedProjectGraphPromise();
    await waitFor(() => aExit.reached);
    writeFileSync(envPath, 'PORT=4201\n');
    await handleOutputsChanges(null, [envEvent]);
    aExit.release();

    // A's drain chains to compute B, which reads 4201 and parks. A
    // committed its graph and file map, so this edit classifies as
    // invalidating for a tracked file; only the outputs watcher delivers.
    await waitFor(() => bExit.reached);
    writeFileSync(envPath, 'PORT=4202\n');
    await handleOutputsChanges(null, [envEvent]);
    bExit.release();

    const result = await first;
    expect(result.error).toBeNull();
    expect(result.projectGraph.nodes.foo.data.tags).toEqual(['env:PORT=4202']);
    expect(retrieveCallCount).toBeGreaterThanOrEqual(3);
    expect(notifiedTags).toEqual([['env:PORT=4202']]);
    const persisted = readFileSync(nxProjectGraph, 'utf-8');
    expect(persisted).toContain('PORT=4202');
    expect(persisted).not.toContain('PORT=4200');
    expect(persisted).not.toContain('PORT=4201');
  });

  // An error result is never cached, notified, or persisted, so when a queued
  // dotenv edit landed mid-computation the failing input may already be fixed
  // on disk: the computation must retry instead of surfacing the error to its
  // awaiting callers.
  it('retries a config error when a queued dotenv edit may have fixed it', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'root' }),
      '.gitignore': '.env.e2e\n',
      'libs/foo/project.json': JSON.stringify({
        name: 'foo',
        root: 'libs/foo',
      }),
      'libs/foo/.env.e2e': 'MODE=bad\n',
    });

    vi.resetModules();
    // The plugin-loader mocks vi.doMock installs in the tests above are
    // registry-wide and outlive vi.resetModules.
    vi.doUnmock('../../project-graph/plugins/get-plugins');
    const { setWorkspaceRoot } = await import('../../utils/workspace-root');
    setWorkspaceRoot(fs.tempDir);
    const { ProjectConfigurationsError } =
      await import('../../project-graph/error-types');

    let releaseFirstRetrieve: () => void;
    const firstRetrieveGate = new Promise<void>((resolve) => {
      releaseFirstRetrieve = resolve;
    });
    let firstRetrieveDone = false;
    let retrieveCallCount = 0;
    // Stands in for a plugin whose createNodes fails on the dotenv-derived
    // config: the retrieval reads the file and throws the structured error
    // while its content is bad.
    vi.doMock(
      '../../project-graph/utils/retrieve-workspace-files',
      async () => {
        const actual = (await vi.importActual(
          '../../project-graph/utils/retrieve-workspace-files'
        )) as any;
        return {
          ...actual,
          retrieveProjectConfigurations: async (...args: unknown[]) => {
            const call = ++retrieveCallCount;
            const result = await actual.retrieveProjectConfigurations(...args);
            const env = readFileSync(
              join(fs.tempDir, 'libs/foo/.env.e2e'),
              'utf-8'
            ).trim();
            result.projects['libs/foo'].tags = [`env:${env}`];
            if (call === 1) {
              firstRetrieveDone = true;
              await firstRetrieveGate;
            }
            if (env === 'MODE=bad') {
              throw new ProjectConfigurationsError(
                [new Error('cannot resolve config: MODE=bad')],
                result
              );
            }
            return result;
          },
        };
      }
    );

    const { getCachedSerializedProjectGraphPromise } =
      await import('./project-graph-incremental-recomputation');
    const { handleOutputsChanges } = await import('./handle-outputs-changes');
    const { EventType } = await import('../../native');

    const first = getCachedSerializedProjectGraphPromise();
    while (!firstRetrieveDone) {
      await new Promise((r) => setImmediate(r));
    }

    writeFileSync(join(fs.tempDir, 'libs/foo/.env.e2e'), 'MODE=good\n');
    // Only the outputs watcher reports the gitignored file; no graph is
    // committed yet, so the event is queued.
    await handleOutputsChanges(null, [
      { path: 'libs/foo/.env.e2e', type: EventType.update },
    ]);
    releaseFirstRetrieve!();

    const result = await first;
    expect(result.error).toBeNull();
    expect(result.projectGraph.nodes.foo.data.tags).toEqual(['env:MODE=good']);
    expect(retrieveCallCount).toBeGreaterThanOrEqual(2);
  });

  // Overflow carries a generation stamp like a queued entry, so a persistent
  // structured error retries exactly once: the retry claims a generation
  // above the recorded stamp and surfaces the error instead of chaining
  // forever.
  it('retries once for lost events, then surfaces a persistent config error', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'root' }),
      '.gitignore': '.env.e2e\n',
      'libs/foo/project.json': JSON.stringify({
        name: 'foo',
        root: 'libs/foo',
      }),
      'libs/foo/.env.e2e': 'MODE=bad\n',
    });

    vi.resetModules();
    // The plugin-loader mocks vi.doMock installs in the tests above are
    // registry-wide and outlive vi.resetModules.
    vi.doUnmock('../../project-graph/plugins/get-plugins');
    const { setWorkspaceRoot } = await import('../../utils/workspace-root');
    setWorkspaceRoot(fs.tempDir);
    const { ProjectConfigurationsError } =
      await import('../../project-graph/error-types');

    let releaseFirstRetrieve: () => void;
    const firstRetrieveGate = new Promise<void>((resolve) => {
      releaseFirstRetrieve = resolve;
    });
    let firstRetrieveDone = false;
    let retrieveCallCount = 0;
    vi.doMock(
      '../../project-graph/utils/retrieve-workspace-files',
      async () => {
        const actual = (await vi.importActual(
          '../../project-graph/utils/retrieve-workspace-files'
        )) as any;
        return {
          ...actual,
          retrieveProjectConfigurations: async (...args: unknown[]) => {
            const call = ++retrieveCallCount;
            const result = await actual.retrieveProjectConfigurations(...args);
            const env = readFileSync(
              join(fs.tempDir, 'libs/foo/.env.e2e'),
              'utf-8'
            ).trim();
            result.projects['libs/foo'].tags = [`env:${env}`];
            if (call === 1) {
              firstRetrieveDone = true;
              await firstRetrieveGate;
            }
            if (env === 'MODE=bad') {
              throw new ProjectConfigurationsError(
                [new Error('cannot resolve config: MODE=bad')],
                result
              );
            }
            return result;
          },
        };
      }
    );

    const {
      getCachedSerializedProjectGraphPromise,
      getRecomputationGeneration,
    } = await import('./project-graph-incremental-recomputation');
    const { queuePendingDotEnvEvents } = await import('./dotenv-graph-changes');

    const first = getCachedSerializedProjectGraphPromise();
    while (!firstRetrieveDone) {
      await new Promise((r) => setImmediate(r));
    }

    // Overflow the queue mid-computation: the lost events could concern any
    // dotenv file, so the erroring compute cannot prove its inputs fresh.
    queuePendingDotEnvEvents(
      Array.from({ length: 1025 }, (_, i) => `dist/out/.env.${i}`),
      getRecomputationGeneration()
    );
    releaseFirstRetrieve!();

    const result = await first;
    expect(result.error?.name).toBe('DaemonProjectGraphError');
    expect(result.projectGraph).toBeNull();
    // Exactly one retry: the second compute outranks the overflow stamp.
    expect(retrieveCallCount).toBe(2);
  });

  // The error-path retry preserves the queue for the successor's drain, but a
  // content hash recorded during the failed computation must not survive into
  // the retry: the successor can read intermediate bytes, and a revert back
  // to the hashed content would then be suppressed after the drain's chance
  // to catch it has passed.
  it('recomputes for a revert delivered while an error retry is reading', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'root' }),
      'libs/foo/project.json': JSON.stringify({
        name: 'foo',
        root: 'libs/foo',
      }),
      'libs/foo/.env.e2e': 'PORT=4200\n',
    });

    vi.resetModules();
    // The plugin-loader mocks vi.doMock installs in the tests above are
    // registry-wide and outlive vi.resetModules.
    vi.doUnmock('../../project-graph/plugins/get-plugins');
    const { setWorkspaceRoot } = await import('../../utils/workspace-root');
    setWorkspaceRoot(fs.tempDir);
    const { ProjectConfigurationsError } =
      await import('../../project-graph/error-types');

    const makeGate = () => {
      let release: () => void;
      const promise = new Promise<void>((resolve) => {
        release = resolve;
      });
      return { promise, release: () => release(), reached: false };
    };
    // B parks after its read and then fails; C parks before and after its
    // read so the intermediate write and the revert land in each window.
    const bExit = makeGate();
    const cEntry = makeGate();
    const cExit = makeGate();
    let retrieveCallCount = 0;
    vi.doMock(
      '../../project-graph/utils/retrieve-workspace-files',
      async () => {
        const actual = (await vi.importActual(
          '../../project-graph/utils/retrieve-workspace-files'
        )) as any;
        return {
          ...actual,
          retrieveProjectConfigurations: async (...args: unknown[]) => {
            const call = ++retrieveCallCount;
            if (call === 3) {
              cEntry.reached = true;
              await cEntry.promise;
            }
            const result = await actual.retrieveProjectConfigurations(...args);
            const env = readFileSync(
              join(fs.tempDir, 'libs/foo/.env.e2e'),
              'utf-8'
            ).trim();
            result.projects['libs/foo'].tags = [`env:${env}`];
            if (call === 2) {
              bExit.reached = true;
              await bExit.promise;
              throw new ProjectConfigurationsError(
                [new Error('transient failure')],
                result
              );
            }
            if (call === 3) {
              cExit.reached = true;
              await cExit.promise;
            }
            return result;
          },
        };
      }
    );

    const { getCachedSerializedProjectGraphPromise, invalidateGraphCache } =
      await import('./project-graph-incremental-recomputation');
    const { handleOutputsChanges } = await import('./handle-outputs-changes');
    const { nxProjectGraph } =
      await import('../../project-graph/nx-deps-cache');
    const { EventType } = await import('../../native');

    const waitFor = async (cond: () => boolean) => {
      while (!cond()) {
        await new Promise((r) => setImmediate(r));
      }
    };
    const envPath = join(fs.tempDir, 'libs/foo/.env.e2e');
    const envEvent = { path: 'libs/foo/.env.e2e', type: EventType.update };

    // Compute A commits a warm graph at 4200.
    const warm = await getCachedSerializedProjectGraphPromise();
    expect(warm.error).toBeNull();

    // Compute B reads 4200 and parks; the edit to 4201 arrives mid-flight,
    // classified against A's committed graph, recording its hash and
    // queueing the tracked path. B then fails transiently.
    invalidateGraphCache();
    const second = getCachedSerializedProjectGraphPromise();
    await waitFor(() => bExit.reached);
    writeFileSync(envPath, 'PORT=4201\n');
    await handleOutputsChanges(null, [envEvent]);
    bExit.release();

    // B's retry starts C, which reads an intermediate 4202 the watcher
    // never reports separately; the file returns to 4201 before the
    // callback hashes it.
    await waitFor(() => cEntry.reached);
    writeFileSync(envPath, 'PORT=4202\n');
    cEntry.release();
    await waitFor(() => cExit.reached);
    writeFileSync(envPath, 'PORT=4201\n');
    await handleOutputsChanges(null, [envEvent]);
    cExit.release();

    const result = await second;
    expect(result.error).toBeNull();
    expect(result.projectGraph.nodes.foo.data.tags).toEqual(['env:PORT=4201']);
    expect(retrieveCallCount).toBeGreaterThanOrEqual(4);
    const persisted = readFileSync(nxProjectGraph, 'utf-8');
    expect(persisted).toContain('PORT=4201');
    expect(persisted).not.toContain('PORT=4200');
    expect(persisted).not.toContain('PORT=4202');
  });

  // With the graph warm and no computation in flight, a tracked dotenv edit
  // the outputs watcher delivers first queues without invalidating, and only
  // the workspace watcher's later delivery schedules a recomputation. A
  // request landing inside that lag must not reuse the cached graph: the
  // queued evidence is classified against the exact graph the cache serves
  // and forces the recomputation the lagging watcher has not scheduled yet.
  it('recomputes when a tracked dotenv edit reaches only the outputs watcher while the graph is warm', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'root' }),
      'libs/foo/project.json': JSON.stringify({
        name: 'foo',
        root: 'libs/foo',
      }),
      'libs/foo/.env.e2e': 'PORT=4200\n',
    });

    vi.resetModules();
    // The plugin-loader mocks vi.doMock installs in the tests above are
    // registry-wide and outlive vi.resetModules.
    vi.doUnmock('../../project-graph/plugins/get-plugins');
    const { setWorkspaceRoot } = await import('../../utils/workspace-root');
    setWorkspaceRoot(fs.tempDir);

    let retrieveCallCount = 0;
    vi.doMock(
      '../../project-graph/utils/retrieve-workspace-files',
      async () => {
        const actual = (await vi.importActual(
          '../../project-graph/utils/retrieve-workspace-files'
        )) as any;
        return {
          ...actual,
          retrieveProjectConfigurations: async (...args: unknown[]) => {
            ++retrieveCallCount;
            const result = await actual.retrieveProjectConfigurations(...args);
            const env = readFileSync(
              join(fs.tempDir, 'libs/foo/.env.e2e'),
              'utf-8'
            ).trim();
            result.projects['libs/foo'].tags = [`env:${env}`];
            return result;
          },
        };
      }
    );

    const { getCachedSerializedProjectGraphPromise } =
      await import('./project-graph-incremental-recomputation');
    const { handleOutputsChanges } = await import('./handle-outputs-changes');
    const { nxProjectGraph } =
      await import('../../project-graph/nx-deps-cache');
    const { EventType } = await import('../../native');

    const first = await getCachedSerializedProjectGraphPromise();
    expect(first.projectGraph.nodes.foo.data.tags).toEqual(['env:PORT=4200']);
    expect(retrieveCallCount).toBe(1);

    writeFileSync(join(fs.tempDir, 'libs/foo/.env.e2e'), 'PORT=4201\n');
    // Only the outputs watcher delivers; the workspace watcher is silent.
    await handleOutputsChanges(null, [
      { path: 'libs/foo/.env.e2e', type: EventType.update },
    ]);

    const second = await getCachedSerializedProjectGraphPromise();
    expect(second.error).toBeNull();
    expect(second.projectGraph.nodes.foo.data.tags).toEqual(['env:PORT=4201']);
    expect(retrieveCallCount).toBe(2);
    const persisted = readFileSync(nxProjectGraph, 'utf-8');
    expect(persisted).toContain('PORT=4201');
    expect(persisted).not.toContain('PORT=4200');
  });

  // The reuse-triggered successor can read intermediate bytes the watcher
  // never reports separately. The content hash recorded when the queued edit
  // was classified must be dropped before that successor starts: kept, a
  // revert back to the queued bytes landing mid-read would be suppressed as a
  // byte-identical rewrite and the successor would serve the intermediate
  // content.
  it('recomputes for a revert delivered while a warm-reuse successor is reading', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'root' }),
      'libs/foo/project.json': JSON.stringify({
        name: 'foo',
        root: 'libs/foo',
      }),
      'libs/foo/.env.e2e': 'PORT=4200\n',
    });

    vi.resetModules();
    // The plugin-loader mocks vi.doMock installs in the tests above are
    // registry-wide and outlive vi.resetModules.
    vi.doUnmock('../../project-graph/plugins/get-plugins');
    const { setWorkspaceRoot } = await import('../../utils/workspace-root');
    setWorkspaceRoot(fs.tempDir);

    const makeGate = () => {
      let release: () => void;
      const promise = new Promise<void>((resolve) => {
        release = resolve;
      });
      return { promise, release: () => release(), reached: false };
    };
    // Park the reuse-triggered compute B before and after its read so an
    // edit lands in each window; computes A and C run unimpeded.
    const bEntry = makeGate();
    const bExit = makeGate();
    let retrieveCallCount = 0;
    vi.doMock(
      '../../project-graph/utils/retrieve-workspace-files',
      async () => {
        const actual = (await vi.importActual(
          '../../project-graph/utils/retrieve-workspace-files'
        )) as any;
        return {
          ...actual,
          retrieveProjectConfigurations: async (...args: unknown[]) => {
            const call = ++retrieveCallCount;
            if (call === 2) {
              bEntry.reached = true;
              await bEntry.promise;
            }
            const result = await actual.retrieveProjectConfigurations(...args);
            const env = readFileSync(
              join(fs.tempDir, 'libs/foo/.env.e2e'),
              'utf-8'
            ).trim();
            result.projects['libs/foo'].tags = [`env:${env}`];
            if (call === 2) {
              bExit.reached = true;
              await bExit.promise;
            }
            return result;
          },
        };
      }
    );

    const { getCachedSerializedProjectGraphPromise } =
      await import('./project-graph-incremental-recomputation');
    const { handleOutputsChanges } = await import('./handle-outputs-changes');
    const { nxProjectGraph } =
      await import('../../project-graph/nx-deps-cache');
    const { EventType } = await import('../../native');

    const waitFor = async (cond: () => boolean) => {
      while (!cond()) {
        await new Promise((r) => setImmediate(r));
      }
    };
    const envPath = join(fs.tempDir, 'libs/foo/.env.e2e');
    const envEvent = { path: 'libs/foo/.env.e2e', type: EventType.update };

    const first = await getCachedSerializedProjectGraphPromise();
    expect(first.projectGraph.nodes.foo.data.tags).toEqual(['env:PORT=4200']);

    // Classifying this edit records the hash of the 4201 bytes and queues
    // the tracked path.
    writeFileSync(envPath, 'PORT=4201\n');
    await handleOutputsChanges(null, [envEvent]);

    // The request finds the queued evidence and triggers compute B, which
    // reads an intermediate 4202 whose write the watcher never reports.
    const second = getCachedSerializedProjectGraphPromise();
    await waitFor(() => bEntry.reached);
    writeFileSync(envPath, 'PORT=4202\n');
    bEntry.release();
    await waitFor(() => bExit.reached);

    // Back to the queued bytes; with the pre-successor hash retained this
    // event would be suppressed as a byte-identical rewrite and B would
    // serve the intermediate content.
    writeFileSync(envPath, 'PORT=4201\n');
    await handleOutputsChanges(null, [envEvent]);
    bExit.release();

    const result = await second;
    expect(result.error).toBeNull();
    expect(result.projectGraph.nodes.foo.data.tags).toEqual(['env:PORT=4201']);
    expect(retrieveCallCount).toBeGreaterThanOrEqual(3);
    const persisted = readFileSync(nxProjectGraph, 'utf-8');
    expect(persisted).toContain('PORT=4201');
    expect(persisted).not.toContain('PORT=4200');
    expect(persisted).not.toContain('PORT=4202');
  });

  // A gitignored dotenv edit classified over a committed graph invalidates
  // directly instead of queueing, so no drain ever drops the hash recorded at
  // classification. Retained, that hash would suppress a coalesced revert
  // callback landing while the forced successor reads, and the successor
  // would serve intermediate content the disk no longer holds.
  it('recomputes for a revert delivered while a direct-invalidation successor is reading', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'root' }),
      '.gitignore': '.env.e2e\n',
      'libs/foo/project.json': JSON.stringify({
        name: 'foo',
        root: 'libs/foo',
      }),
      'libs/foo/.env.e2e': 'PORT=4200\n',
    });

    vi.resetModules();
    // The plugin-loader mocks vi.doMock installs in the tests above are
    // registry-wide and outlive vi.resetModules.
    vi.doUnmock('../../project-graph/plugins/get-plugins');
    const { setWorkspaceRoot } = await import('../../utils/workspace-root');
    setWorkspaceRoot(fs.tempDir);

    const makeGate = () => {
      let release: () => void;
      const promise = new Promise<void>((resolve) => {
        release = resolve;
      });
      return { promise, release: () => release(), reached: false };
    };
    // Park the invalidation-triggered compute B before and after its read
    // so an edit lands in each window; computes A and C run unimpeded.
    const bEntry = makeGate();
    const bExit = makeGate();
    let retrieveCallCount = 0;
    vi.doMock(
      '../../project-graph/utils/retrieve-workspace-files',
      async () => {
        const actual = (await vi.importActual(
          '../../project-graph/utils/retrieve-workspace-files'
        )) as any;
        return {
          ...actual,
          retrieveProjectConfigurations: async (...args: unknown[]) => {
            const call = ++retrieveCallCount;
            if (call === 2) {
              bEntry.reached = true;
              await bEntry.promise;
            }
            const result = await actual.retrieveProjectConfigurations(...args);
            const env = readFileSync(
              join(fs.tempDir, 'libs/foo/.env.e2e'),
              'utf-8'
            ).trim();
            result.projects['libs/foo'].tags = [`env:${env}`];
            if (call === 2) {
              bExit.reached = true;
              await bExit.promise;
            }
            return result;
          },
        };
      }
    );

    const { getCachedSerializedProjectGraphPromise } =
      await import('./project-graph-incremental-recomputation');
    const { handleOutputsChanges } = await import('./handle-outputs-changes');
    const { nxProjectGraph } =
      await import('../../project-graph/nx-deps-cache');
    const { EventType } = await import('../../native');

    const waitFor = async (cond: () => boolean) => {
      while (!cond()) {
        await new Promise((r) => setImmediate(r));
      }
    };
    const envPath = join(fs.tempDir, 'libs/foo/.env.e2e');
    const envEvent = { path: 'libs/foo/.env.e2e', type: EventType.update };

    const first = await getCachedSerializedProjectGraphPromise();
    expect(first.projectGraph.nodes.foo.data.tags).toEqual(['env:PORT=4200']);

    // Classifying this edit records the hash of the 4301 bytes; the file is
    // gitignored, so the committed file map does not know it and the path
    // invalidates directly instead of queueing.
    writeFileSync(envPath, 'PORT=4301\n');
    await handleOutputsChanges(null, [envEvent]);

    // The request finds no cached graph and triggers compute B, which reads
    // an intermediate 4302 whose write the watcher never reports.
    const second = getCachedSerializedProjectGraphPromise();
    await waitFor(() => bEntry.reached);
    writeFileSync(envPath, 'PORT=4302\n');
    bEntry.release();
    await waitFor(() => bExit.reached);

    // Back to the classified bytes; with the classification-time hash
    // retained this event would be suppressed as a byte-identical rewrite
    // and B would serve the intermediate content.
    writeFileSync(envPath, 'PORT=4301\n');
    await handleOutputsChanges(null, [envEvent]);
    bExit.release();

    const result = await second;
    expect(result.error).toBeNull();
    expect(result.projectGraph.nodes.foo.data.tags).toEqual(['env:PORT=4301']);
    expect(retrieveCallCount).toBeGreaterThanOrEqual(3);
    const persisted = readFileSync(nxProjectGraph, 'utf-8');
    expect(persisted).toContain('PORT=4301');
    expect(persisted).not.toContain('PORT=4200');
    expect(persisted).not.toContain('PORT=4302');
  });

  // A tracked dotenv edit queued in the same batch as (or before) a gitignored
  // one keeps its classification-time hash while the gitignored path forces a
  // successor, and its stamp predates that successor, so the drain deletes the
  // hash without marking the successor stale. Only clearing every recorded
  // hash at the direct invalidation keeps a coalesced revert of the tracked
  // file from being suppressed while the successor reads.
  it('recomputes for a tracked-file revert delivered while a successor forced by a gitignored edit is reading', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'root' }),
      '.gitignore': '.env.e2e\n',
      'libs/foo/project.json': JSON.stringify({
        name: 'foo',
        root: 'libs/foo',
      }),
      'libs/foo/.env.k': 'KPORT=4200\n',
      'libs/foo/.env.e2e': 'UPORT=9000\n',
    });

    vi.resetModules();
    // The plugin-loader mocks vi.doMock installs in the tests above are
    // registry-wide and outlive vi.resetModules.
    vi.doUnmock('../../project-graph/plugins/get-plugins');
    const { setWorkspaceRoot } = await import('../../utils/workspace-root');
    setWorkspaceRoot(fs.tempDir);

    const makeGate = () => {
      let release: () => void;
      const promise = new Promise<void>((resolve) => {
        release = resolve;
      });
      return { promise, release: () => release(), reached: false };
    };
    // Park the invalidation-triggered compute B before and after its read
    // so an edit lands in each window; computes A and C run unimpeded.
    const bEntry = makeGate();
    const bExit = makeGate();
    let retrieveCallCount = 0;
    vi.doMock(
      '../../project-graph/utils/retrieve-workspace-files',
      async () => {
        const actual = (await vi.importActual(
          '../../project-graph/utils/retrieve-workspace-files'
        )) as any;
        return {
          ...actual,
          retrieveProjectConfigurations: async (...args: unknown[]) => {
            const call = ++retrieveCallCount;
            if (call === 2) {
              bEntry.reached = true;
              await bEntry.promise;
            }
            const result = await actual.retrieveProjectConfigurations(...args);
            const tracked = readFileSync(
              join(fs.tempDir, 'libs/foo/.env.k'),
              'utf-8'
            ).trim();
            const ignored = readFileSync(
              join(fs.tempDir, 'libs/foo/.env.e2e'),
              'utf-8'
            ).trim();
            result.projects['libs/foo'].tags = [`env:${tracked}|${ignored}`];
            if (call === 2) {
              bExit.reached = true;
              await bExit.promise;
            }
            return result;
          },
        };
      }
    );

    const { getCachedSerializedProjectGraphPromise } =
      await import('./project-graph-incremental-recomputation');
    const { handleOutputsChanges } = await import('./handle-outputs-changes');
    const { nxProjectGraph } =
      await import('../../project-graph/nx-deps-cache');
    const { EventType } = await import('../../native');

    const waitFor = async (cond: () => boolean) => {
      while (!cond()) {
        await new Promise((r) => setImmediate(r));
      }
    };
    const trackedPath = join(fs.tempDir, 'libs/foo/.env.k');
    const ignoredPath = join(fs.tempDir, 'libs/foo/.env.e2e');
    const trackedEvent = { path: 'libs/foo/.env.k', type: EventType.update };
    const ignoredEvent = {
      path: 'libs/foo/.env.e2e',
      type: EventType.update,
    };

    const first = await getCachedSerializedProjectGraphPromise();
    expect(first.projectGraph.nodes.foo.data.tags).toEqual([
      'env:KPORT=4200|UPORT=9000',
    ]);

    // One batch: the tracked edit queues with its 4301 hash recorded while
    // the gitignored edit invalidates directly, forcing a successor.
    writeFileSync(trackedPath, 'KPORT=4301\n');
    writeFileSync(ignoredPath, 'UPORT=9001\n');
    await handleOutputsChanges(null, [trackedEvent, ignoredEvent]);

    // The request finds no cached graph and triggers compute B, which reads
    // an intermediate 4302 whose write the watcher never reports.
    const second = getCachedSerializedProjectGraphPromise();
    await waitFor(() => bEntry.reached);
    writeFileSync(trackedPath, 'KPORT=4302\n');
    bEntry.release();
    await waitFor(() => bExit.reached);

    // Back to the queued bytes; with the tracked path's hash retained this
    // event would be suppressed as a byte-identical rewrite, and B's drain
    // would drop the earlier queued entry as safely pre-dating B.
    writeFileSync(trackedPath, 'KPORT=4301\n');
    await handleOutputsChanges(null, [trackedEvent]);
    bExit.release();

    const result = await second;
    expect(result.error).toBeNull();
    expect(result.projectGraph.nodes.foo.data.tags).toEqual([
      'env:KPORT=4301|UPORT=9001',
    ]);
    expect(retrieveCallCount).toBeGreaterThanOrEqual(3);
    const persisted = readFileSync(nxProjectGraph, 'utf-8');
    expect(persisted).toContain('KPORT=4301');
    expect(persisted).not.toContain('KPORT=4200');
    expect(persisted).not.toContain('KPORT=4302');
  });

  // A tracked dotenv edit classified after a direct invalidation but before
  // the forced successor starts records a fresh hash that no handler-side
  // clear has seen. Only clearing the hashes when a computation claims its
  // generation bounds every hash to the window since the last claim, so a
  // coalesced revert of the tracked file cannot be suppressed while that
  // successor reads.
  it('recomputes for a tracked-file revert when the tracked edit was classified between an invalidation and the successor', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'root' }),
      '.gitignore': '.env.e2e\n',
      'libs/foo/project.json': JSON.stringify({
        name: 'foo',
        root: 'libs/foo',
      }),
      'libs/foo/.env.k': 'KPORT=4200\n',
      'libs/foo/.env.e2e': 'UPORT=9000\n',
    });

    vi.resetModules();
    // The plugin-loader mocks vi.doMock installs in the tests above are
    // registry-wide and outlive vi.resetModules.
    vi.doUnmock('../../project-graph/plugins/get-plugins');
    const { setWorkspaceRoot } = await import('../../utils/workspace-root');
    setWorkspaceRoot(fs.tempDir);

    const makeGate = () => {
      let release: () => void;
      const promise = new Promise<void>((resolve) => {
        release = resolve;
      });
      return { promise, release: () => release(), reached: false };
    };
    // Park the invalidation-triggered compute B before and after its read
    // so an edit lands in each window; computes A and C run unimpeded.
    const bEntry = makeGate();
    const bExit = makeGate();
    let retrieveCallCount = 0;
    vi.doMock(
      '../../project-graph/utils/retrieve-workspace-files',
      async () => {
        const actual = (await vi.importActual(
          '../../project-graph/utils/retrieve-workspace-files'
        )) as any;
        return {
          ...actual,
          retrieveProjectConfigurations: async (...args: unknown[]) => {
            const call = ++retrieveCallCount;
            if (call === 2) {
              bEntry.reached = true;
              await bEntry.promise;
            }
            const result = await actual.retrieveProjectConfigurations(...args);
            const tracked = readFileSync(
              join(fs.tempDir, 'libs/foo/.env.k'),
              'utf-8'
            ).trim();
            const ignored = readFileSync(
              join(fs.tempDir, 'libs/foo/.env.e2e'),
              'utf-8'
            ).trim();
            result.projects['libs/foo'].tags = [`env:${tracked}|${ignored}`];
            if (call === 2) {
              bExit.reached = true;
              await bExit.promise;
            }
            return result;
          },
        };
      }
    );

    const { getCachedSerializedProjectGraphPromise } =
      await import('./project-graph-incremental-recomputation');
    const { handleOutputsChanges } = await import('./handle-outputs-changes');
    const { nxProjectGraph } =
      await import('../../project-graph/nx-deps-cache');
    const { EventType } = await import('../../native');

    const waitFor = async (cond: () => boolean) => {
      while (!cond()) {
        await new Promise((r) => setImmediate(r));
      }
    };
    const trackedPath = join(fs.tempDir, 'libs/foo/.env.k');
    const ignoredPath = join(fs.tempDir, 'libs/foo/.env.e2e');
    const trackedEvent = { path: 'libs/foo/.env.k', type: EventType.update };
    const ignoredEvent = {
      path: 'libs/foo/.env.e2e',
      type: EventType.update,
    };

    const first = await getCachedSerializedProjectGraphPromise();
    expect(first.projectGraph.nodes.foo.data.tags).toEqual([
      'env:KPORT=4200|UPORT=9000',
    ]);

    // The gitignored edit invalidates directly, clearing the hashes; the
    // tracked edit lands in a later callback, so its 4301 hash is recorded
    // after every handler-side clear has run.
    writeFileSync(ignoredPath, 'UPORT=9001\n');
    await handleOutputsChanges(null, [ignoredEvent]);
    writeFileSync(trackedPath, 'KPORT=4301\n');
    await handleOutputsChanges(null, [trackedEvent]);

    // The request finds no cached graph and triggers compute B, which reads
    // an intermediate 4302 whose write the watcher never reports.
    const second = getCachedSerializedProjectGraphPromise();
    await waitFor(() => bEntry.reached);
    writeFileSync(trackedPath, 'KPORT=4302\n');
    bEntry.release();
    await waitFor(() => bExit.reached);

    // Back to the queued bytes; with the post-invalidation hash retained
    // this event would be suppressed as a byte-identical rewrite, and B's
    // drain would drop the earlier queued entry as safely pre-dating B.
    writeFileSync(trackedPath, 'KPORT=4301\n');
    await handleOutputsChanges(null, [trackedEvent]);
    bExit.release();

    const result = await second;
    expect(result.error).toBeNull();
    expect(result.projectGraph.nodes.foo.data.tags).toEqual([
      'env:KPORT=4301|UPORT=9001',
    ]);
    expect(retrieveCallCount).toBeGreaterThanOrEqual(3);
    const persisted = readFileSync(nxProjectGraph, 'utf-8');
    expect(persisted).toContain('KPORT=4301');
    expect(persisted).not.toContain('KPORT=4200');
    expect(persisted).not.toContain('KPORT=4302');
  });

  // The clear that bounds the recorded hashes must run at the generation
  // claim, not earlier in the kickoff: plugin loading awaits between the two,
  // and a tracked edit classified in that window records a hash an earlier
  // clear has already run for, which would then suppress a coalesced revert
  // landing while the computation reads.
  it('recomputes for a tracked-file revert when the tracked edit was classified while the successor loads plugins', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'root' }),
      '.gitignore': '.env.e2e\n',
      'libs/foo/project.json': JSON.stringify({
        name: 'foo',
        root: 'libs/foo',
      }),
      'libs/foo/.env.k': 'KPORT=4200\n',
      'libs/foo/.env.e2e': 'UPORT=9000\n',
    });

    vi.resetModules();
    const { setWorkspaceRoot } = await import('../../utils/workspace-root');
    setWorkspaceRoot(fs.tempDir);

    const makeGate = () => {
      let release: () => void;
      const promise = new Promise<void>((resolve) => {
        release = resolve;
      });
      return { promise, release: () => release(), reached: false };
    };
    // Park compute B while it loads plugins (before its generation claim)
    // and before and after its read; computes A and C run unimpeded.
    const bPlugins = makeGate();
    const bEntry = makeGate();
    const bExit = makeGate();
    let pluginsCallCount = 0;
    vi.doMock('../../project-graph/plugins/get-plugins', async () => {
      const actual = (await vi.importActual(
        '../../project-graph/plugins/get-plugins'
      )) as any;
      return {
        ...actual,
        getPluginsSeparated: async (...args: unknown[]) => {
          const call = ++pluginsCallCount;
          if (call === 2) {
            bPlugins.reached = true;
            await bPlugins.promise;
          }
          return actual.getPluginsSeparated(...args);
        },
      };
    });
    let retrieveCallCount = 0;
    vi.doMock(
      '../../project-graph/utils/retrieve-workspace-files',
      async () => {
        const actual = (await vi.importActual(
          '../../project-graph/utils/retrieve-workspace-files'
        )) as any;
        return {
          ...actual,
          retrieveProjectConfigurations: async (...args: unknown[]) => {
            const call = ++retrieveCallCount;
            if (call === 2) {
              bEntry.reached = true;
              await bEntry.promise;
            }
            const result = await actual.retrieveProjectConfigurations(...args);
            const tracked = readFileSync(
              join(fs.tempDir, 'libs/foo/.env.k'),
              'utf-8'
            ).trim();
            const ignored = readFileSync(
              join(fs.tempDir, 'libs/foo/.env.e2e'),
              'utf-8'
            ).trim();
            result.projects['libs/foo'].tags = [`env:${tracked}|${ignored}`];
            if (call === 2) {
              bExit.reached = true;
              await bExit.promise;
            }
            return result;
          },
        };
      }
    );

    const { getCachedSerializedProjectGraphPromise } =
      await import('./project-graph-incremental-recomputation');
    const { handleOutputsChanges } = await import('./handle-outputs-changes');
    const { nxProjectGraph } =
      await import('../../project-graph/nx-deps-cache');
    const { EventType } = await import('../../native');

    const waitFor = async (cond: () => boolean) => {
      while (!cond()) {
        await new Promise((r) => setImmediate(r));
      }
    };
    const trackedPath = join(fs.tempDir, 'libs/foo/.env.k');
    const ignoredPath = join(fs.tempDir, 'libs/foo/.env.e2e');
    const trackedEvent = { path: 'libs/foo/.env.k', type: EventType.update };
    const ignoredEvent = {
      path: 'libs/foo/.env.e2e',
      type: EventType.update,
    };

    const first = await getCachedSerializedProjectGraphPromise();
    expect(first.projectGraph.nodes.foo.data.tags).toEqual([
      'env:KPORT=4200|UPORT=9000',
    ]);

    // The gitignored edit invalidates directly, so the request kicks
    // compute B, which parks while loading plugins.
    writeFileSync(ignoredPath, 'UPORT=9001\n');
    await handleOutputsChanges(null, [ignoredEvent]);
    const second = getCachedSerializedProjectGraphPromise();
    await waitFor(() => bPlugins.reached);

    // The tracked edit is classified while B loads plugins: after B was
    // kicked, before B claims its generation and clears the hashes.
    writeFileSync(trackedPath, 'KPORT=4301\n');
    await handleOutputsChanges(null, [trackedEvent]);
    bPlugins.release();

    // B claims and reads an intermediate 4302 the watcher never reports.
    await waitFor(() => bEntry.reached);
    writeFileSync(trackedPath, 'KPORT=4302\n');
    bEntry.release();
    await waitFor(() => bExit.reached);

    // Back to the classified bytes; a hash surviving B's claim would
    // suppress this event and let B serve the intermediate content.
    writeFileSync(trackedPath, 'KPORT=4301\n');
    await handleOutputsChanges(null, [trackedEvent]);
    bExit.release();

    const result = await second;
    expect(result.error).toBeNull();
    expect(result.projectGraph.nodes.foo.data.tags).toEqual([
      'env:KPORT=4301|UPORT=9001',
    ]);
    expect(retrieveCallCount).toBeGreaterThanOrEqual(3);
    const persisted = readFileSync(nxProjectGraph, 'utf-8');
    expect(persisted).toContain('KPORT=4301');
    expect(persisted).not.toContain('KPORT=4200');
    expect(persisted).not.toContain('KPORT=4302');
  });

  // A slow stale computation assigns currentProjectGraph before it discovers
  // it lost, so after the winner settles that variable can describe an older
  // graph until the loser chains away. The warm-reuse check must classify
  // queued evidence against the graph the cache actually serves: against the
  // overwritten currentProjectGraph, an edit under a root only the served
  // graph knows would be dismissed and the stale cache reused.
  it('classifies warm-reuse evidence against the served graph, not one a stale computation left behind', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'root' }),
      '.gitignore': '.env.e2e\n',
      'libs/foo/project.json': JSON.stringify({
        name: 'foo',
        root: 'libs/foo',
      }),
    });

    vi.resetModules();
    // The plugin-loader mocks vi.doMock installs in the tests above are
    // registry-wide and outlive vi.resetModules.
    vi.doUnmock('../../project-graph/plugins/get-plugins');
    const { setWorkspaceRoot } = await import('../../utils/workspace-root');
    setWorkspaceRoot(fs.tempDir);

    const makeGate = () => {
      let release: () => void;
      const promise = new Promise<void>((resolve) => {
        release = resolve;
      });
      return { promise, release: () => release(), reached: false };
    };
    // Park compute A inside createAndSerializeProjectGraph, before its
    // graph is built and assigned to currentProjectGraph. getPlugins is
    // awaited there right before the build, after every earlier staleness
    // gate, so the park keeps A's late assignment as the last write.
    const aPark = makeGate();
    let retrieveCallCount = 0;
    vi.doMock(
      '../../project-graph/utils/retrieve-workspace-files',
      async () => {
        const actual = (await vi.importActual(
          '../../project-graph/utils/retrieve-workspace-files'
        )) as any;
        return {
          ...actual,
          retrieveProjectConfigurations: async (...args: unknown[]) => {
            ++retrieveCallCount;
            const result = await actual.retrieveProjectConfigurations(...args);
            for (const [root, project] of Object.entries(result.projects)) {
              const envFile = join(fs.tempDir, root, '.env.e2e');
              if (existsSync(envFile)) {
                (project as { tags?: string[] }).tags = [
                  `env:${readFileSync(envFile, 'utf-8').trim()}`,
                ];
              }
            }
            return result;
          },
        };
      }
    );
    // A plain factory: the module sits in a require cycle, so resolving
    // the actual inside the factory recurses. getPluginsSeparated resolves
    // it lazily at call time instead (project discovery needs the real
    // default plugins); the faked getPlugins only skips dependency hooks
    // these assertions never read.
    let pluginsCallCount = 0;
    vi.doMock('../../project-graph/plugins/get-plugins', async () => ({
      __esModule: true,
      getPlugins: async () => {
        const call = ++pluginsCallCount;
        if (call === 1) {
          aPark.reached = true;
          await aPark.promise;
        }
        return [];
      },
      getPluginsSeparated: async (...args: unknown[]) =>
        (
          await vi.importActual<
            typeof import('../../project-graph/plugins/get-plugins')
          >('../../project-graph/plugins/get-plugins')
        ).getPluginsSeparated(...args),
    }));

    const pgir = await import('./project-graph-incremental-recomputation');
    const {
      getCachedSerializedProjectGraphPromise,
      scheduleProjectGraphRecomputation,
    } = pgir;
    const { handleOutputsChanges } = await import('./handle-outputs-changes');
    const { EventType } = await import('../../native');

    const waitFor = async (cond: () => boolean) => {
      while (!cond()) {
        await new Promise((r) => setImmediate(r));
      }
    };

    // Compute A sees only foo and parks before building and assigning its
    // graph.
    const first = getCachedSerializedProjectGraphPromise();
    await waitFor(() => aPark.reached);

    // The workspace watcher delivers a new project; the winning compute
    // builds the graph the cache will serve, with bar as a root.
    mkdirSync(join(fs.tempDir, 'libs/bar'), { recursive: true });
    writeFileSync(
      join(fs.tempDir, 'libs/bar/project.json'),
      JSON.stringify({ name: 'bar', root: 'libs/bar' })
    );
    scheduleProjectGraphRecomputation(['libs/bar/project.json'], [], []);
    const second = await getCachedSerializedProjectGraphPromise();
    expect(second.projectGraph.nodes.bar).toBeDefined();

    // The stale A resumes, builds and assigns its bar-less graph over
    // currentProjectGraph, and only then chains away.
    aPark.release();
    await first;
    expect(pgir.currentProjectGraph.nodes.bar).toBeUndefined();

    // A gitignored dotenv edit under bar: only the outputs watcher
    // reports it, and against the overwritten currentProjectGraph the
    // path classifies under no root, so it queues.
    writeFileSync(join(fs.tempDir, 'libs/bar/.env.e2e'), 'PORT=7777\n');
    await handleOutputsChanges(null, [
      { path: 'libs/bar/.env.e2e', type: EventType.update },
    ]);

    const countBeforeThird = retrieveCallCount;
    const third = await getCachedSerializedProjectGraphPromise();
    expect(third.error).toBeNull();
    expect(third.projectGraph.nodes.bar.data.tags).toEqual(['env:PORT=7777']);
    expect(retrieveCallCount).toBe(countBeforeThird + 1);
  });

  // When the workspace watcher delivers the tracked edit too, its
  // recomputation alone must satisfy a request racing it: the queued twin
  // event describes an edit that recomputation's read already observes, so
  // the reuse check must neither discard the in-flight computation nor force
  // a second one after it settles.
  it('does not add a recomputation when the workspace watcher schedules one for the same edit', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'root' }),
      'libs/foo/project.json': JSON.stringify({
        name: 'foo',
        root: 'libs/foo',
      }),
      'libs/foo/.env.e2e': 'PORT=4200\n',
    });

    vi.resetModules();
    // The plugin-loader mocks vi.doMock installs in the tests above are
    // registry-wide and outlive vi.resetModules.
    vi.doUnmock('../../project-graph/plugins/get-plugins');
    const { setWorkspaceRoot } = await import('../../utils/workspace-root');
    setWorkspaceRoot(fs.tempDir);

    const makeGate = () => {
      let release: () => void;
      const promise = new Promise<void>((resolve) => {
        release = resolve;
      });
      return { promise, release: () => release(), reached: false };
    };
    // Park the workspace-scheduled compute B at its getPlugins await, past
    // its file read and its collected-file cleanup, so a request races an
    // in-flight computation deterministically.
    const bPark = makeGate();
    let retrieveCallCount = 0;
    vi.doMock(
      '../../project-graph/utils/retrieve-workspace-files',
      async () => {
        const actual = (await vi.importActual(
          '../../project-graph/utils/retrieve-workspace-files'
        )) as any;
        return {
          ...actual,
          retrieveProjectConfigurations: async (...args: unknown[]) => {
            ++retrieveCallCount;
            const result = await actual.retrieveProjectConfigurations(...args);
            const env = readFileSync(
              join(fs.tempDir, 'libs/foo/.env.e2e'),
              'utf-8'
            ).trim();
            result.projects['libs/foo'].tags = [`env:${env}`];
            return result;
          },
        };
      }
    );
    // A plain factory: the module sits in a require cycle, so resolving
    // the actual inside the factory recurses. getPluginsSeparated resolves
    // it lazily at call time instead (project discovery needs the real
    // default plugins); the faked getPlugins only skips dependency hooks
    // these assertions never read.
    let pluginsCallCount = 0;
    vi.doMock('../../project-graph/plugins/get-plugins', async () => ({
      __esModule: true,
      getPlugins: async () => {
        const call = ++pluginsCallCount;
        if (call === 2) {
          bPark.reached = true;
          await bPark.promise;
        }
        return [];
      },
      getPluginsSeparated: async (...args: unknown[]) =>
        (
          await vi.importActual<
            typeof import('../../project-graph/plugins/get-plugins')
          >('../../project-graph/plugins/get-plugins')
        ).getPluginsSeparated(...args),
    }));

    const {
      getCachedSerializedProjectGraphPromise,
      scheduleProjectGraphRecomputation,
    } = await import('./project-graph-incremental-recomputation');
    const { handleOutputsChanges } = await import('./handle-outputs-changes');
    const { EventType } = await import('../../native');

    const waitFor = async (cond: () => boolean) => {
      while (!cond()) {
        await new Promise((r) => setImmediate(r));
      }
    };
    const envPath = join(fs.tempDir, 'libs/foo/.env.e2e');

    const first = await getCachedSerializedProjectGraphPromise();
    expect(first.projectGraph.nodes.foo.data.tags).toEqual(['env:PORT=4200']);
    expect(retrieveCallCount).toBe(1);

    writeFileSync(envPath, 'PORT=4201\n');
    // Outputs watcher first: the event queues. Workspace watcher second:
    // the recomputation it schedules reads the new content.
    await handleOutputsChanges(null, [
      { path: 'libs/foo/.env.e2e', type: EventType.update },
    ]);
    scheduleProjectGraphRecomputation([], ['libs/foo/.env.e2e'], []);
    await waitFor(() => bPark.reached);

    // A request while B is parked mid-build must chain onto B, not start
    // a competitor from the queued twin event. The yields let it run its
    // reuse decision before B is released.
    const second = getCachedSerializedProjectGraphPromise();
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setImmediate(r));
    }
    bPark.release();

    const result = await second;
    expect(result.error).toBeNull();
    expect(result.projectGraph.nodes.foo.data.tags).toEqual(['env:PORT=4201']);
    expect(retrieveCallCount).toBe(2);

    // After B settles, the drained queue holds no evidence against it.
    const third = await getCachedSerializedProjectGraphPromise();
    expect(third.projectGraph.nodes.foo.data.tags).toEqual(['env:PORT=4201']);
    expect(retrieveCallCount).toBe(2);
  });

  // An event under a root no served graph knows cannot make the cached graph
  // stale, so it must not force a recomputation on its own. It stays queued
  // for the computation that adds its root, whose own read observes the file
  // content, so the generation rule retires the entry there without another
  // recomputation.
  it('leaves an unclassifiable queued event for the computation that adds its root', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'root' }),
      '.gitignore': '.env.e2e\n',
      'libs/foo/project.json': JSON.stringify({
        name: 'foo',
        root: 'libs/foo',
      }),
    });

    vi.resetModules();
    // The plugin-loader mocks vi.doMock installs in the tests above are
    // registry-wide and outlive vi.resetModules.
    vi.doUnmock('../../project-graph/plugins/get-plugins');
    const { setWorkspaceRoot } = await import('../../utils/workspace-root');
    setWorkspaceRoot(fs.tempDir);

    let retrieveCallCount = 0;
    vi.doMock(
      '../../project-graph/utils/retrieve-workspace-files',
      async () => {
        const actual = (await vi.importActual(
          '../../project-graph/utils/retrieve-workspace-files'
        )) as any;
        return {
          ...actual,
          retrieveProjectConfigurations: async (...args: unknown[]) => {
            ++retrieveCallCount;
            const result = await actual.retrieveProjectConfigurations(...args);
            for (const [root, project] of Object.entries(result.projects)) {
              const envFile = join(fs.tempDir, root, '.env.e2e');
              if (existsSync(envFile)) {
                (project as { tags?: string[] }).tags = [
                  `env:${readFileSync(envFile, 'utf-8').trim()}`,
                ];
              }
            }
            return result;
          },
        };
      }
    );

    const {
      getCachedSerializedProjectGraphPromise,
      registerProjectGraphRecomputationListener,
      scheduleProjectGraphRecomputation,
    } = await import('./project-graph-incremental-recomputation');
    const { handleOutputsChanges } = await import('./handle-outputs-changes');
    const { EventType } = await import('../../native');

    const notifiedGraphs: import('../../config/project-graph').ProjectGraph[] =
      [];
    registerProjectGraphRecomputationListener(
      (graph: import('../../config/project-graph').ProjectGraph) => {
        notifiedGraphs.push(graph);
      }
    );
    const waitFor = async (cond: () => boolean) => {
      while (!cond()) {
        await new Promise((r) => setImmediate(r));
      }
    };

    const first = await getCachedSerializedProjectGraphPromise();
    expect(first.projectGraph.nodes.bar).toBeUndefined();
    expect(retrieveCallCount).toBe(1);

    // A gitignored dotenv file under a directory that is not a project
    // root yet: only the outputs watcher reports it, and no root of the
    // served graph classifies it.
    mkdirSync(join(fs.tempDir, 'libs/bar'), { recursive: true });
    writeFileSync(join(fs.tempDir, 'libs/bar/.env.e2e'), 'PORT=7777\n');
    await handleOutputsChanges(null, [
      { path: 'libs/bar/.env.e2e', type: EventType.update },
    ]);

    const second = await getCachedSerializedProjectGraphPromise();
    expect(second.projectGraph.nodes.bar).toBeUndefined();
    expect(retrieveCallCount).toBe(1);

    // The project lands; the workspace watcher schedules the computation
    // that knows the root, and its read observes the dotenv content.
    writeFileSync(
      join(fs.tempDir, 'libs/bar/project.json'),
      JSON.stringify({ name: 'bar', root: 'libs/bar' })
    );
    scheduleProjectGraphRecomputation(['libs/bar/project.json'], [], []);
    await waitFor(() =>
      notifiedGraphs.some((graph) => graph.nodes.bar !== undefined)
    );

    const third = await getCachedSerializedProjectGraphPromise();
    expect(third.error).toBeNull();
    expect(third.projectGraph.nodes.bar.data.tags).toEqual(['env:PORT=7777']);
    expect(retrieveCallCount).toBe(2);

    const fourth = await getCachedSerializedProjectGraphPromise();
    expect(fourth.projectGraph.nodes.bar.data.tags).toEqual(['env:PORT=7777']);
    expect(retrieveCallCount).toBe(2);
  });
});
