const state = vi.hoisted(() => ({
  graph: { error: null as unknown, projectGraph: { nodes: {} } as any },
  selection: {
    affectedTaskIds: new Set(['app:build']),
    requiredTaskIds: ['app:build'],
    taskGraph: {
      roots: [],
      tasks: {},
      dependencies: {},
      continuousDependencies: {},
    },
    runTaskGraph: undefined,
    plans: {} as unknown,
  },
}));

vi.mock('./project-graph-incremental-recomputation', () => ({
  getCachedSerializedProjectGraphPromise: async () => state.graph,
}));
vi.mock('../../config/configuration', () => ({ readNxJson: () => ({}) }));
vi.mock('../../hasher/task-planning-context', () => ({
  createTaskPlanningContext: () => ({}),
}));
const selectAffectedTasks = vi.hoisted(() =>
  vi.fn(async () => state.selection)
);
vi.mock('../../project-graph/affected/affected-tasks', () => ({
  selectAffectedTasks,
}));
const keepSelectionPlans = vi.hoisted(() => vi.fn());
vi.mock('./handle-hash-tasks', () => ({ keepSelectionPlans }));

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
  it('returns the graph it selected against, and keeps the plans beside it', async () => {
    const { response } = await handleSelectAffectedTasks(request);

    expect(selectAffectedTasks.mock.calls[0][0]).toBe(state.graph.projectGraph);
    expect((response as any).projectGraph).toBe(state.graph.projectGraph);
    expect((response as any).affectedTaskIds).toEqual(['app:build']);
    expect(keepSelectionPlans).toHaveBeenCalledWith(
      state.graph.projectGraph,
      state.selection.taskGraph,
      state.selection.plans
    );
  });

  it('fails with the graph error rather than selecting', async () => {
    const error = new Error('broken graph');
    state.graph = { error, projectGraph: null };

    await expect(handleSelectAffectedTasks(request)).rejects.toBe(error);
    expect(selectAffectedTasks).not.toHaveBeenCalled();
  });
});
