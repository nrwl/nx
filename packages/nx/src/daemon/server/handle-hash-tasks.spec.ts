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
vi.mock('./planning-context', () => ({ planningContextFor: () => ({}) }));
const mockGetStored = vi.fn((commit: string, fetchedAt: number) => ({
  commit,
  resolution: { fetchedAt },
}));
// Lazy so the hoisted mock factory does not touch the const before it exists.
vi.mock('../../native', () => ({
  IoSnapshotStore: vi.fn(function () {
    return {
      getVersion: (commit: string, fetchedAt: number) =>
        mockGetStored(commit, fetchedAt),
    };
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

  it('gets the version the client names and keeps one handle while it holds', async () => {
    const version = { commit: 'abc', fetchedAt: 1 };
    await handleHashTasks({ ...base, ioSnapshots: version });
    expect(mockGetStored).toHaveBeenLastCalledWith('abc', 1);
    const first = hashTasks.mock.lastCall[5];
    expect(first).toMatchObject({ commit: 'abc' });
    await handleHashTasksUpfront({ ...base, ioSnapshots: version });
    // Identity, not shape: the mock returns an equal object on every call.
    expect(hashTasksUpfront.mock.lastCall[5]).toBe(first);
    // A client on a newer version of the same commit gets that version.
    await handleHashTasks({
      ...base,
      ioSnapshots: { commit: 'abc', fetchedAt: 2 },
    });
    const newer = hashTasks.mock.lastCall[5];
    expect(newer).not.toBe(first);
    expect(newer.resolution.fetchedAt).toBe(2);
    // A different commit is a different handle even when the fetch times match.
    await handleHashTasks({
      ...base,
      ioSnapshots: { commit: 'def', fetchedAt: 2 },
    });
    expect(hashTasks.mock.lastCall[5]).toMatchObject({ commit: 'def' });
    expect(hashTasks.mock.lastCall[5]).not.toBe(newer);
  });

  it('hashes natively when the version is no longer stored', async () => {
    mockGetStored.mockImplementationOnce(() => null);
    await handleHashTasks({
      ...base,
      ioSnapshots: { commit: 'gone', fetchedAt: 1 },
    });
    expect(hashTasks.mock.lastCall[5]).toBeUndefined();
  });

  it('hashes natively when the store cannot be opened', async () => {
    mockGetStored.mockImplementationOnce(() => {
      throw new Error('database disk image is malformed');
    });
    await handleHashTasks({
      ...base,
      ioSnapshots: { commit: 'broken', fetchedAt: 1 },
    });
    expect(hashTasks.mock.lastCall[5]).toBeUndefined();
  });

  it('passes nothing when the client sends no version', async () => {
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
