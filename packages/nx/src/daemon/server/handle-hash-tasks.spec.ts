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

  it('forwards the fetched bundle directory to the hasher on every request', async () => {
    const ioSnapshots = { bundleDir: '/w/.nx/cache/io-snapshots/abc' };
    await handleHashTasks({ ...base, ioSnapshots });
    expect(hashTasks).toHaveBeenLastCalledWith(
      base.tasks,
      base.taskGraph,
      base.perTaskEnvs,
      base.cwd,
      false,
      ioSnapshots
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
