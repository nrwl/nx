const state = vi.hoisted(() => ({
  graph: { error: null as unknown, projectGraph: { nodes: {} } as any },
  selection: {
    affectedTaskIds: new Set(['app:build']),
    taskGraph: {
      roots: [],
      tasks: {},
      dependencies: {},
      continuousDependencies: {},
    },
    taskSelection: {
      taskGraph: {
        roots: [],
        tasks: {},
        dependencies: {},
        continuousDependencies: {},
      },
      initiatingTaskIds: ['app:build'],
      taskIds: ['app:build'],
    },
  },
}));

vi.mock('./project-graph-incremental-recomputation', () => ({
  getCachedSerializedProjectGraphPromise: async () => state.graph,
}));
vi.mock('../../config/configuration', () => ({ readNxJson: () => ({}) }));
const planningContext = vi.hoisted(() => ({}));
const planningContextFor = vi.hoisted(() => vi.fn(() => planningContext));
vi.mock('./planning-context', () => ({ planningContextFor }));
const configurations = vi.hoisted(() => ({}));
const getUltracacheConfigurationsForVersion = vi.hoisted(() =>
  vi.fn(() => configurations)
);
vi.mock('./ultracache-configuration-state', () => ({
  getUltracacheConfigurationsForVersion,
}));
const selectAffectedTasks = vi.hoisted(() =>
  vi.fn(async () => state.selection)
);
vi.mock('../../project-graph/affected/affected-tasks', () => ({
  selectAffectedTasks,
}));

import { handleSelectAffectedTasks } from './handle-select-affected-tasks';

describe('handleSelectAffectedTasks', () => {
  const request = {
    targets: ['build'],
    changedFiles: ['apps/app/src/main.ts'],
    overrides: {},
    extraTargetDependencies: {},
    excludeTaskDependencies: false,
    exclude: [],
  };

  beforeEach(() => vi.clearAllMocks());

  // The client runs with this graph, so its ids match the selection's.
  it('returns the graph it selected against, planning with the shared planner', async () => {
    const { response } = await handleSelectAffectedTasks(request);

    expect(selectAffectedTasks.mock.calls[0][0]).toBe(state.graph.projectGraph);
    expect((response as any).projectGraph).toBe(state.graph.projectGraph);
    expect((response as any).affectedTaskIds).toEqual(['app:build']);
    expect((response as any).taskSelection).toBe(state.selection.taskSelection);
    expect(planningContextFor).toHaveBeenCalledWith(
      state.graph.projectGraph,
      {}
    );
    expect(selectAffectedTasks.mock.calls[0][2]).toBe(planningContext);
  });

  // The run hashes with this version, so selection plans with it too.
  it('plans with the configurations version the client sent', async () => {
    const version = { commit: 'abc', fetchedAt: 7 };
    await handleSelectAffectedTasks({
      ...request,
      ultracacheConfigurationsVersion: version,
    });

    expect(getUltracacheConfigurationsForVersion).toHaveBeenCalledWith(version);
    expect(selectAffectedTasks.mock.calls[0][4]).toEqual({
      ultracacheConfigurations: configurations,
    });
  });

  it('fails with the graph error rather than selecting', async () => {
    const error = new Error('broken graph');
    state.graph = { error, projectGraph: null };

    await expect(handleSelectAffectedTasks(request)).rejects.toBe(error);
    expect(selectAffectedTasks).not.toHaveBeenCalled();
  });
});
