const state = vi.hoisted(() => ({
  projectGraph: undefined as unknown,
  hashers: [] as Array<{ planningContext: unknown }>,
}));

vi.mock('./project-graph-incremental-recomputation', () => ({
  getCachedSerializedProjectGraphPromise: async () => ({
    error: null,
    projectGraph: state.projectGraph,
    rustReferences: null,
  }),
}));
vi.mock('../../config/configuration', () => ({ readNxJson: () => ({}) }));
vi.mock('../../hasher/task-planning-context', () => ({
  createTaskPlanningContext: (projectGraph: unknown) => ({ projectGraph }),
}));
vi.mock('../../hasher/task-hasher', () => ({
  InProcessTaskHasher: class {
    hashTasks = vi.fn(async () => []);
    constructor(...args: unknown[]) {
      state.hashers.push({ planningContext: args[5] });
    }
  },
}));

const payload = {
  runnerOptions: {},
  tasks: [],
  taskGraph: {
    roots: [],
    tasks: {},
    dependencies: {},
    continuousDependencies: {},
  },
  perTaskEnvs: {},
  cwd: '/',
};

describe('the daemon planning context', () => {
  let hashTasks: typeof import('./handle-hash-tasks');
  let planning: typeof import('./planning-context');

  beforeEach(async () => {
    vi.resetModules();
    state.hashers = [];
    hashTasks = await import('./handle-hash-tasks');
    planning = await import('./planning-context');
  });

  // Selection plans with this planner, so hashing with it reuses those plans.
  it('is the one the hasher plans with for the same graph', async () => {
    state.projectGraph = { nodes: {} };
    const selection = planning.planningContextFor(
      state.projectGraph as any,
      {}
    );

    await hashTasks.handleHashTasks(payload);

    expect(state.hashers.at(-1).planningContext).toBe(selection);
  });

  // Plans made over the old graph must not answer for a recomputed one, however alike.
  it('is replaced once the project graph is recomputed', async () => {
    const before = { nodes: {} } as any;
    const first = planning.planningContextFor(before, {});
    state.projectGraph = { nodes: {} };

    await hashTasks.handleHashTasks(payload);

    expect(state.hashers.at(-1).planningContext).not.toBe(first);
    expect(planning.planningContextFor(before, {})).not.toBe(first);
  });
});
