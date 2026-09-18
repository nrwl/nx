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
  failedAcquires: 0,
  builds: 0,
  writes: 0,
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
    state.releases = [false];

    await createProjectGraphAndSourceMapsAsync();

    expect(state.reads).toBe(0);
    expect(state.waits).toBe(1);
    expect(state.acquires).toBe(0);
    expect(state.builds).toBe(1);
    expect(state.writes).toBe(0);
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
