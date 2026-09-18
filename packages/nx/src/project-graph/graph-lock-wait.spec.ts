vi.unmock('./project-graph');

const state = vi.hoisted(() => ({
  locked: true,
  cachedGraph: null as unknown,
  waits: 0,
  reads: 0,
  acquires: 0,
  tryLocks: 0,
  failedAcquires: 0,
  builds: 0,
  writes: 0,
  events: [] as string[],
  notedComputedAt: undefined as number | undefined,
  /** How many reads find the holder stopped without writing a graph. */
  holdersStoppedWithoutWriting: 0,
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
    wait = async (): Promise<void> => {
      state.waits++;
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
vi.mock('./nx-deps-cache', async () => {
  const { StaleProjectGraphCacheError } = await import('./error-types');
  return {
    readProjectGraphCache: () => {
      state.reads++;
      if (state.holdersStoppedWithoutWriting > 0) {
        state.holdersStoppedWithoutWriting--;
        throw new StaleProjectGraphCacheError();
      }
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
  };
});
vi.mock('./plugins/graph-plugin-capabilities', () => ({
  noteGraphReadFromCache: (computedAt: number | undefined) => {
    state.notedComputedAt = computedAt;
    if (computedAt !== undefined) {
      state.events.push(`read graph @${computedAt}`);
    }
  },
  capabilitiesOfLoadedPlugin: () => ({}),
  getGraphPluginCapabilitiesStore: () => ({
    record: (computedAt: number) =>
      state.events.push(`record capabilities @${computedAt}`),
  }),
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
    state.cachedGraph = null;
    state.waits = 0;
    state.reads = 0;
    state.acquires = 0;
    state.tryLocks = 0;
    state.failedAcquires = 0;
    state.builds = 0;
    state.writes = 0;
    state.events = [];
    state.notedComputedAt = undefined;
    state.holdersStoppedWithoutWriting = 0;
  });

  it('reads the graph the holder wrote, once it has released', async () => {
    const { projectGraph } = await createProjectGraphAndSourceMapsAsync();

    expect(projectGraph).toEqual({ nodes: {}, dependencies: {} });
    expect(state.reads).toBe(1);
    expect(state.builds).toBe(0);
  });

  it('builds and writes the graph itself when the holder stopped without writing one', async () => {
    state.holdersStoppedWithoutWriting = 1;

    await createProjectGraphAndSourceMapsAsync();

    expect(state.reads).toBe(1);
    expect(state.acquires).toBe(1);
    expect(state.builds).toBe(1);
    expect(state.writes).toBe(1);
  });

  it('waits for whoever took over from a holder that stopped without writing', async () => {
    state.holdersStoppedWithoutWriting = 1;
    // The first tryLock and the retry after the stale read both lose.
    state.failedAcquires = 2;

    const { projectGraph } = await createProjectGraphAndSourceMapsAsync();

    expect(projectGraph).toEqual({ nodes: {}, dependencies: {} });
    expect(state.waits).toBe(2);
    expect(state.reads).toBe(2);
    expect(state.builds).toBe(0);
  });

  it('waits for the winner rather than building a second graph', async () => {
    // Another process wins the tryLock race.
    state.locked = false;
    state.failedAcquires = 1;

    const { projectGraph } = await createProjectGraphAndSourceMapsAsync();

    expect(projectGraph).toEqual({ nodes: {}, dependencies: {} });
    expect(state.tryLocks).toBe(1);
    expect(state.waits).toBe(1);
    expect(state.reads).toBe(1);
    expect(state.builds).toBe(0);
    expect(state.acquires).toBe(0);
  });

  it('notes which build the graph it read came from', async () => {
    await createProjectGraphAndSourceMapsAsync();

    expect(state.events).toEqual(['read graph @1700000000000']);
  });

  it('forgets the graph it read once it builds its own', async () => {
    await createProjectGraphAndSourceMapsAsync();
    expect(state.notedComputedAt).toBe(1_700_000_000_000);

    state.locked = false;
    await createProjectGraphAndSourceMapsAsync();

    expect(state.builds).toBe(1);
    expect(state.notedComputedAt).toBeUndefined();
  });

  it('records what its plugins register before the graph it built', async () => {
    state.locked = false;

    await createProjectGraphAndSourceMapsAsync();

    const [record, write] = state.events;
    expect(record).toMatch(/^record capabilities @\d+$/);
    expect(write).toBe(record.replace('record capabilities', 'write graph'));
  });

  it('writes the cache when it built the graph under the lock', async () => {
    state.locked = false;

    await createProjectGraphAndSourceMapsAsync();

    expect(state.acquires).toBe(1);
    expect(state.builds).toBe(1);
    expect(state.writes).toBe(1);
  });
});
