vi.unmock('./project-graph');

const state = vi.hoisted(() => ({
  locked: true,
  /** Whether each wait reports the holder released; default is released. */
  releases: [] as boolean[],
  cachedGraph: null as unknown,
  waits: 0,
  reads: 0,
  acquires: 0,
  builds: 0,
  writes: 0,
}));

vi.mock('../native', () => ({
  IS_WASM: false,
  FileLock: class {
    // What `new FileLock()` reports: whether anyone held it at that moment.
    locked = state.locked;
    check = () => state.locked;
    lock = () => {
      state.acquires++;
    };
    unlock = () => {};
    waitForRelease = async () => {
      state.waits++;
      const released = state.releases.shift() ?? true;
      if (released) {
        state.locked = false;
        // Whoever held it wrote the graph before letting go.
        state.cachedGraph = { nodes: {}, dependencies: {} };
      }
      return released;
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
  readSourceMapsCache: () => ({}),
  readFileMapCache: () => null,
  writeCache: () => {
    state.writes++;
  },
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
    state.builds = 0;
    state.writes = 0;
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

  it('writes the cache when it built the graph under the lock', async () => {
    // Free by the time this process looks, so it is the holder.
    state.locked = false;

    await createProjectGraphAndSourceMapsAsync();

    expect(state.acquires).toBe(1);
    expect(state.builds).toBe(1);
    expect(state.writes).toBe(1);
  });
});
