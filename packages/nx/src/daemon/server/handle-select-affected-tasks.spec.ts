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
    explanation: {
      affected: { 'app:build': [{ kind: 'input-file', file: 'x.ts' }] },
      upstream: {},
      touched: ['app:build'],
    },
  },
}));

const getCachedSerializedProjectGraphPromise = vi.hoisted(() =>
  vi.fn(async (_socket?: unknown) => state.graph)
);
vi.mock('./project-graph-incremental-recomputation', () => ({
  getCachedSerializedProjectGraphPromise,
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

import type { Socket } from 'net';
import { ProgressTopics } from '../../utils/progress-topics';
import { getTopicSubscribers } from './client-socket-context';
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
  const socket = {} as Socket;

  beforeEach(() => vi.clearAllMocks());

  // The client runs with this graph, so its ids match the selection's.
  it('returns the graph it selected against, planning with the shared planner', async () => {
    const { response } = await handleSelectAffectedTasks(request, socket);

    expect(selectAffectedTasks.mock.calls[0][0]).toBe(state.graph.projectGraph);
    expect((response as any).projectGraph).toBe(state.graph.projectGraph);
    expect((response as any).affectedTaskIds).toEqual(['app:build']);
    expect((response as any).taskSelection).toBe(state.selection.taskSelection);
    expect((response as any).explanation).toBe(state.selection.explanation);
    expect(planningContextFor).toHaveBeenCalledWith(
      state.graph.projectGraph,
      {}
    );
    expect(selectAffectedTasks.mock.calls[0][2]).toBe(planningContext);
  });

  // The run hashes with this version, so selection plans with it too.
  it('plans with the configurations version the client sent', async () => {
    const version = { commit: 'abc', fetchedAt: 7 };
    await handleSelectAffectedTasks(
      {
        ...request,
        ultracacheConfigurationsVersion: version,
      },
      socket
    );

    expect(getUltracacheConfigurationsForVersion).toHaveBeenCalledWith(version);
    expect(selectAffectedTasks.mock.calls[0][4]).toEqual({
      ultracacheConfigurations: configurations,
    });
  });

  // The client's spinner shows graph construction, then selection.
  it('streams graph and selection progress to the requesting client', async () => {
    let subscribedDuringSelection = false;
    selectAffectedTasks.mockImplementationOnce(async () => {
      subscribedDuringSelection = getTopicSubscribers(
        ProgressTopics.AffectedTasks
      ).has(socket);
      return state.selection;
    });

    await handleSelectAffectedTasks(request, socket);

    expect(getCachedSerializedProjectGraphPromise).toHaveBeenCalledWith(socket);
    expect(subscribedDuringSelection).toBe(true);
    expect(getTopicSubscribers(ProgressTopics.AffectedTasks).has(socket)).toBe(
      false
    );
  });

  it('stops streaming selection progress when selection fails', async () => {
    selectAffectedTasks.mockRejectedValueOnce(new Error('selection failed'));

    await expect(handleSelectAffectedTasks(request, socket)).rejects.toThrow(
      'selection failed'
    );
    expect(getTopicSubscribers(ProgressTopics.AffectedTasks).has(socket)).toBe(
      false
    );
  });

  it('fails with the graph error rather than selecting', async () => {
    const error = new Error('broken graph');
    state.graph = { error, projectGraph: null };

    await expect(handleSelectAffectedTasks(request, socket)).rejects.toBe(
      error
    );
    expect(selectAffectedTasks).not.toHaveBeenCalled();
  });
});
