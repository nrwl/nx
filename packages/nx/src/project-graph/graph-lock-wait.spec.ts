vi.unmock('./project-graph');

const state = vi.hoisted(() => ({
  locked: true,
  /** Whether each wait reports the holder released; default is released. */
  releases: [] as boolean[],
  cachedGraph: null as unknown,
  waits: 0,
  reads: 0,
}));

vi.mock('../native', () => ({
  IS_WASM: false,
  FileLock: class {
    locked = true;
    check = () => state.locked;
    lock = () => {};
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
  writeCache: vi.fn(),
}));
vi.mock('./utils/retrieve-workspace-files', () => ({
  retrieveWorkspaceFiles: async () => ({ fileMap: {}, rustReferences: {} }),
  retrieveProjectConfigurations: vi.fn(),
}));
vi.mock('./build-project-graph', () => ({
  hydrateFileMap: vi.fn(),
  buildProjectGraphUsingProjectFileMap: vi.fn(),
}));

import { createProjectGraphAndSourceMapsAsync } from './project-graph';

describe('waiting on the graph lock', () => {
  it('waits again rather than reading a graph nobody has written', async () => {
    // The holder is still building when the first wait runs out of time.
    state.releases = [false];

    const { projectGraph } = await createProjectGraphAndSourceMapsAsync();

    expect(projectGraph).toEqual({ nodes: {}, dependencies: {} });
    expect(state.waits).toBe(2);
    // Reading before the holder released throws "No cached ProjectGraph is
    // available", which is not the stale-cache error the loop recovers from, so
    // a workspace with no graph yet would fail the command outright.
    expect(state.reads).toBe(1);
  });
});
