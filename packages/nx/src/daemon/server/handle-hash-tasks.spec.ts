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
const mockLoadIoSnapshots = vi.fn((db: string, commit: string) => ({
  commit,
  resolution: { digest: `digest-of-${commit}` },
}));
// Lazy so the hoisted mock factory does not touch the const before it exists.
vi.mock('../../native', () => ({
  loadIoSnapshots: (db: string, commit: string) =>
    mockLoadIoSnapshots(db, commit),
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

  it('loads the stored set for the commit and keeps one handle while its digest holds', async () => {
    const commit = 'abc';
    await handleHashTasks({ ...base, ioSnapshots: { commit } });
    expect(mockLoadIoSnapshots).toHaveBeenLastCalledWith('db', commit);
    const first = hashTasks.mock.lastCall[5];
    expect(first).toMatchObject({ commit });
    await handleHashTasksUpfront({ ...base, ioSnapshots: { commit } });
    expect(hashTasksUpfront).toHaveBeenLastCalledWith(
      base.tasks,
      base.taskGraph,
      base.perTaskEnvs,
      base.cwd,
      false,
      first
    );
    // A re-import for the same commit (new digest) replaces the handle.
    mockLoadIoSnapshots.mockImplementationOnce((db, c) => ({
      commit: c,
      resolution: { digest: 'new' },
    }));
    await handleHashTasks({ ...base, ioSnapshots: { commit } });
    expect(hashTasks.mock.lastCall[5]).not.toBe(first);
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
