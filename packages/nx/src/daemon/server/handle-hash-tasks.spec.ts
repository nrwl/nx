const hashTasks = jest.fn().mockResolvedValue([]);
jest.mock('../../hasher/task-hasher', () => ({
  InProcessTaskHasher: jest.fn().mockImplementation(() => ({ hashTasks })),
}));
jest.mock('./project-graph-incremental-recomputation', () => ({
  getCachedSerializedProjectGraphPromise: jest.fn().mockResolvedValue({
    error: null,
    projectGraph: { nodes: {}, dependencies: {} },
    rustReferences: null,
  }),
}));
jest.mock('../../config/configuration', () => ({ readNxJson: () => ({}) }));
const mockLoadIoSnapshots = jest.fn((directory: string) => ({ directory }));
// Lazy so the hoisted mock factory does not touch the const before it exists.
jest.mock('../../native', () => ({
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
