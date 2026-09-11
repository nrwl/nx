const hashTasks = vi.fn().mockResolvedValue([]);
vi.mock('../../hasher/task-hasher', () => ({
  // A plain function so `new InProcessTaskHasher(...)` works (arrows are not
  // constructible under vitest's mocks).
  InProcessTaskHasher: vi.fn().mockImplementation(function () {
    return { hashTasks };
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
const mockLoadIoSnapshots = vi.fn((directory: string) => ({ directory }));
// Lazy so the hoisted mock factory does not touch the const before it exists.
vi.mock('../../native', () => ({
  loadIoSnapshots: (directory: string) => mockLoadIoSnapshots(directory),
}));

import { handleHashTasks } from './handle-hash-tasks';

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

  it('loads the fetched bundle and hands the instance to the hasher on every request', async () => {
    const directory = '/w/.nx/cache/io-snapshots/abc';
    await handleHashTasks({ ...base, ioSnapshots: { directory } });
    expect(mockLoadIoSnapshots).toHaveBeenLastCalledWith(directory);
    expect(hashTasks).toHaveBeenLastCalledWith(
      base.tasks,
      base.taskGraph,
      base.perTaskEnvs,
      base.cwd,
      false,
      { directory }
    );
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
