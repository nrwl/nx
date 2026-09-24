import type { TaskGraph } from '../../config/task-graph';

const state = vi.hoisted(() => ({
  projectGraph: undefined as unknown,
  hashers: [] as Array<{ adoptSelectionPlans: ReturnType<typeof vi.fn> }>,
}));

vi.mock('./project-graph-incremental-recomputation', () => ({
  getCachedSerializedProjectGraphPromise: async () => ({
    error: null,
    projectGraph: state.projectGraph,
    rustReferences: null,
  }),
}));
vi.mock('../../config/configuration', () => ({ readNxJson: () => ({}) }));
vi.mock('../../hasher/task-hasher', () => ({
  InProcessTaskHasher: class {
    adoptSelectionPlans = vi.fn();
    hashTasks = vi.fn(async () => []);
    constructor() {
      state.hashers.push(this);
    }
  },
}));

const taskGraph: TaskGraph = {
  roots: [],
  tasks: {},
  dependencies: {},
  continuousDependencies: {},
};
const plans = {} as any;
const payload = {
  runnerOptions: {},
  tasks: [],
  taskGraph,
  perTaskEnvs: {},
  cwd: '/',
};

describe('selection plans in the daemon', () => {
  let module: typeof import('./handle-hash-tasks');

  beforeEach(async () => {
    vi.resetModules();
    state.hashers = [];
    module = await import('./handle-hash-tasks');
  });

  it('hands the kept plans to the hasher for the graph they were built over', async () => {
    state.projectGraph = { nodes: {} };
    module.keepSelectionPlans(state.projectGraph, taskGraph, plans);

    await module.handleHashTasks(payload);

    expect(state.hashers.at(-1).adoptSelectionPlans).toHaveBeenCalledWith(
      plans,
      taskGraph
    );
  });

  // A recompute yields a new graph object with the same content, so the task
  // graph looks identical and plannedAlike would accept the old plans. Only
  // the identity of the project graph they were built over can refuse them.
  it('drops them once the project graph is recomputed, however alike it looks', async () => {
    const before = { nodes: {} };
    state.projectGraph = before;
    module.keepSelectionPlans(before, taskGraph, plans);
    await module.handleHashTasks(payload);

    state.projectGraph = { nodes: {} };
    await module.handleHashTasks(payload);

    const recomputed = state.hashers.at(-1);
    expect(state.hashers).toHaveLength(2);
    expect(recomputed.adoptSelectionPlans).not.toHaveBeenCalled();
  });
});
