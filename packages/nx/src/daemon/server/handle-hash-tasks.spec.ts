const hashTasks = vi.fn().mockResolvedValue([]);
const hashTasksUpfront = vi.fn().mockResolvedValue({});
vi.mock('../../hasher/task-hasher', () => ({
  // A plain function so `new InProcessTaskHasher(...)` works (arrows are not
  // constructible under vitest's mocks).
  InProcessTaskHasher: vi.fn().mockImplementation(function () {
    return { hashTasks, hashTasksUpfront };
  }),
}));
vi.mock('./project-graph-incremental-recomputation', () => ({
  getCachedSerializedProjectGraphPromise: vi.fn().mockResolvedValue({
    error: null,
    projectGraph: { nodes: {}, dependencies: {} },
    rustReferences: null,
  }),
}));
vi.mock('../../config/configuration', () => ({ readNxJson: () => ({}) }));
const mockGetStored = vi.fn((commit: string) => ({
  commit,
  resolution: { fetchedAt: 1 },
}));
// Lazy so the hoisted mock factory does not touch the const before it exists.
vi.mock('../../native', () => ({
  IoSnapshotStore: vi.fn(function () {
    return { get: (commit: string) => mockGetStored(commit) };
  }),
}));
vi.mock('../../utils/db-connection', () => ({ getDbConnection: () => 'db' }));

import { handleHashTasks, handleHashTasksUpfront } from './handle-hash-tasks';

describe('handleHashTasks', () => {
  const base = {
    runnerOptions: {},
    tasks: [],
    taskGraph: {
      roots: [],
      tasks: {},
      dependencies: {},
      continuousDependencies: {},
    },
    perTaskEnvs: {},
    cwd: '/w',
    collectInputs: false,
  };

  it('gets the stored set for the commit and keeps one handle while its import holds', async () => {
    const commit = 'abc';
    await handleHashTasks({ ...base, ioSnapshots: { commit } });
    expect(mockGetStored).toHaveBeenLastCalledWith(commit);
    const first = hashTasks.mock.lastCall[5];
    expect(first).toMatchObject({ commit });
    await handleHashTasksUpfront({ ...base, ioSnapshots: { commit } });
    // Identity, not shape: the mock returns an equal object on every call.
    expect(hashTasksUpfront.mock.lastCall[5]).toBe(first);
    // A re-import for the same commit (new fetch time) replaces the handle.
    mockGetStored.mockImplementationOnce((c) => ({
      commit: c,
      resolution: { fetchedAt: 2 },
    }));
    await handleHashTasks({ ...base, ioSnapshots: { commit } });
    const replaced = hashTasks.mock.lastCall[5];
    expect(replaced).not.toBe(first);
    // A different commit is a different handle even when the fetch times match.
    mockGetStored.mockImplementationOnce((c) => ({
      commit: c,
      resolution: { fetchedAt: 2 },
    }));
    await handleHashTasks({ ...base, ioSnapshots: { commit: 'def' } });
    expect(hashTasks.mock.lastCall[5]).toMatchObject({ commit: 'def' });
    expect(hashTasks.mock.lastCall[5]).not.toBe(replaced);
  });

  it('hashes natively when the commit has no stored set', async () => {
    mockGetStored.mockImplementationOnce(() => null);
    await handleHashTasks({ ...base, ioSnapshots: { commit: 'gone' } });
    expect(hashTasks.mock.lastCall[5]).toBeUndefined();
  });

  it('hashes natively when the store cannot be opened', async () => {
    mockGetStored.mockImplementationOnce(() => {
      throw new Error('database disk image is malformed');
    });
    await handleHashTasks({ ...base, ioSnapshots: { commit: 'broken' } });
    expect(hashTasks.mock.lastCall[5]).toBeUndefined();
  });

  it('passes nothing when an older client omits the field', async () => {
    await handleHashTasks({ ...base });
    expect(hashTasks).toHaveBeenLastCalledWith(
      base.tasks,
      base.taskGraph,
      base.perTaskEnvs,
      base.cwd,
      false,
      undefined
    );
  });
});
