vi.unmock('./project-graph');

const state = vi.hoisted(() => ({
  locked: true,
  /** Whether each wait reports the holder released; default is released. */
  releases: [] as boolean[],
  cachedGraph: null as unknown,
  waits: 0,
  reads: 0,
  acquires: 0,
  tryLocks: 0,
  /** How many acquire attempts lose the race before one wins. */
  failedAcquires: 0,
  builds: 0,
  writes: 0,
  /** What happened to plugin capabilities and the graph, in order. */
  events: [] as string[],
}));

vi.mock('../native', () => ({
  IS_WASM: false,
  FileLock: class {
    locked = state.locked;
    check = () => state.locked;
    unlock = () => {
      state.locked = false;
    };
    tryLock = () => {
      state.tryLocks++;
      // Someone else got there between this process looking and acquiring.
      if (state.failedAcquires > 0) {
        state.failedAcquires--;
        state.locked = true;
        return false;
      }
      if (state.locked) {
        return false;
      }
      state.locked = true;
      state.acquires++;
      return true;
    };
    waitUntilFree = async (): Promise<void> => {
      state.waits++;
      const released = state.releases.shift() ?? true;
      if (!released) {
        // What the native wait rejects with once the budget is gone.
        throw Object.assign(new Error('timed out'), { code: 'Timeout' });
      }
      state.locked = false;
      // Whoever held it wrote the graph before letting go.
      state.cachedGraph = { nodes: {}, dependencies: {} };
    };
  },
}));

vi.mock('../daemon/is-on-daemon', () => ({ isOnDaemon: () => false }));
vi.mock('../daemon/client/client', () => ({
  daemonClient: { enabled: () => false, reset: vi.fn() },
}));
vi.mock('./nx-deps-cache', () => ({
  readProjectGraphCache: () => {
    state.reads++;
    return state.cachedGraph;
  },
  readStampedProjectGraphCache: () => {
    state.reads++;
    return state.cachedGraph
      ? { projectGraph: state.cachedGraph, computedAt: 1_700_000_000_000 }
      : null;
  },
  readSourceMapsCache: () => ({}),
  readFileMapCache: () => null,
  writeCache: (...args: unknown[]) => {
    state.writes++;
    state.events.push(`write graph @${args[4]}`);
  },
}));
vi.mock('./plugins/graph-plugin-capabilities', () => ({
  noteGraphReadFromCache: (computedAt: number) =>
    state.events.push(`read graph @${computedAt}`),
  recordGraphPluginCapabilities: (computedAt: number) =>
    state.events.push(`record capabilities @${computedAt}`),
}));
vi.mock('./utils/retrieve-workspace-files', () => ({
  retrieveWorkspaceFiles: async () => ({ fileMap: {}, rustReferences: {} }),
  retrieveProjectConfigurations: async () => ({
    projects: {},
    externalNodes: {},
    sourceMaps: {},
    projectRootMap: {},
  }),
}));
vi.mock('./build-project-graph', () => ({
  hydrateFileMap: vi.fn(),
  buildProjectGraphUsingProjectFileMap: async () => {
    state.builds++;
    return {
      projectGraph: { nodes: {}, dependencies: {} },
      projectFileMapCache: {},
    };
  },
}));
vi.mock('../utils/workspace-context', () => ({
  refreshWorkspaceContext: vi.fn(),
}));
vi.mock('../config/nx-json', () => ({ readNxJson: () => ({}) }));
vi.mock('./plugins/get-plugins', () => ({
  getPlugins: async () => [],
  getPluginsSeparated: async () => ({
    specifiedPlugins: [],
    defaultPlugins: [],
  }),
}));

import { createProjectGraphAndSourceMapsAsync } from './project-graph';

describe('waiting on the graph lock', () => {
  beforeEach(() => {
    state.locked = true;
    state.releases = [];
    state.cachedGraph = null;
    state.waits = 0;
    state.reads = 0;
    state.acquires = 0;
    state.tryLocks = 0;
    state.failedAcquires = 0;
    state.builds = 0;
    state.writes = 0;
    state.events = [];
  });

  it('reads the graph the holder wrote, once it has released', async () => {
    const { projectGraph } = await createProjectGraphAndSourceMapsAsync();

    expect(projectGraph).toEqual({ nodes: {}, dependencies: {} });
    expect(state.reads).toBe(1);
    expect(state.builds).toBe(0);
  });

  it('builds the graph itself when the holder outlasts the budget', async () => {
    // A holder that never releases: suspended, stalled on its filesystem, or
    // wedged in a plugin that blocks before its own timeout can fire.
    state.releases = [false];

    await createProjectGraphAndSourceMapsAsync();

    // Reading before the holder released throws "No cached ProjectGraph is
    // available", which is not the stale-cache error the loop recovers from, so
    // a workspace with no graph yet would fail the command outright.
    expect(state.reads).toBe(0);
    // And waiting again would be the unbounded wait under another name, which
    // leaves a whole checkout with no command that returns.
    expect(state.waits).toBe(1);
    // The lock is left to whoever holds it. Acquiring it blocks, so a process
    // that gave up on the wait cannot then queue for it.
    expect(state.acquires).toBe(0);
    expect(state.builds).toBe(1);
    // The cache belongs to whoever holds the lock. Two writers rename three
    // files into place one at a time, so writing from out here could leave a
    // graph and the source maps that explain it describing different runs.
    expect(state.writes).toBe(0);
  });

  it('waits for the winner rather than building a second graph', async () => {
    // Free when this process looked, taken by someone else before it could
    // acquire. The old check-then-act lost that race silently: it blocked on
    // `lock()` until the winner released and then built a second graph anyway.
    state.locked = false;
    state.failedAcquires = 1;

    const { projectGraph } = await createProjectGraphAndSourceMapsAsync();

    expect(projectGraph).toEqual({ nodes: {}, dependencies: {} });
    expect(state.tryLocks).toBe(1);
    // It waited for the winner and read what the winner wrote.
    expect(state.waits).toBe(1);
    expect(state.reads).toBe(1);
    expect(state.builds).toBe(0);
    expect(state.acquires).toBe(0);
  });

  it('notes which build the graph it read came from', async () => {
    // It did not load the plugins that built this graph, so what they register
    // has to come from what that build recorded, found by this stamp.
    await createProjectGraphAndSourceMapsAsync();

    expect(state.events).toEqual(['read graph @1700000000000']);
  });

  it('records what its plugins register before the graph it built', async () => {
    state.locked = false;

    await createProjectGraphAndSourceMapsAsync();

    // Same stamp on both, and the record first, so no graph on disk is ever
    // without the row that describes it.
    const [record, write] = state.events;
    expect(record).toMatch(/^record capabilities @\d+$/);
    expect(write).toBe(record.replace('record capabilities', 'write graph'));
  });

  it('writes the cache when it built the graph under the lock', async () => {
    // Free by the time this process looks, so it is the holder.
    state.locked = false;

    await createProjectGraphAndSourceMapsAsync();

    expect(state.acquires).toBe(1);
    expect(state.builds).toBe(1);
    expect(state.writes).toBe(1);
  });
});
