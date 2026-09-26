import { hashTasksThatDoNotDependOnOutputsOfOtherTasks } from './hash-task';
import type { Hash, TaskHasher } from './task-hasher';
import { ProjectGraphBuilder } from '../project-graph/project-graph-builder';
import { createTaskGraph } from '../tasks-runner/create-task-graph';

vi.mock('../tasks-runner/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../tasks-runner/utils')>()),
  getCustomHasher: (task: { target: { target: string } }) =>
    task.target.target === 'custom' ? () => null : null,
}));
// The real implementation reads the workspace's .env files.
vi.mock('../tasks-runner/task-env', () => ({
  getTaskSpecificEnv: () => ({}),
}));
const deferredBySnapshot = vi.hoisted(() => ({ ids: [] as string[] }));
vi.mock('../native', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../native')>()),
  getIoSnapshotDeferredTaskIds: () => deferredBySnapshot.ids,
}));

describe('hashTasksThatDoNotDependOnOutputsOfOtherTasks', () => {
  const nxJson = {
    namedInputs: {
      default: ['{projectRoot}/**/*'],
      production: ['default', { dependentTasksOutputFiles: '**/*.d.ts' }],
    },
  } as any;
  const hashOf = (id: string): Hash => ({
    value: `hash-${id}`,
    details: {} as any,
  });

  function graph() {
    const builder = new ProjectGraphBuilder();
    builder.addNode({
      name: 'app',
      type: 'app',
      data: {
        root: 'apps/app',
        targets: {
          build: {
            executor: 'nx:run-commands',
            outputs: ['{workspaceRoot}/dist/apps/app'],
          },
          e2e: {
            executor: 'nx:run-commands',
            dependsOn: ['build'],
            inputs: [
              '{projectRoot}/**/*',
              { dependentTasksOutputFiles: '**/*.d.ts' },
            ],
          },
          // Reads outputs only through its dependency's `production`, which
          // this side never expands.
          test: {
            executor: 'nx:run-commands',
            dependsOn: ['build'],
            inputs: ['^production'],
          },
          custom: { executor: 'nx:run-commands' },
        },
      },
    });
    const projectGraph = builder.getUpdatedProjectGraph();
    const taskGraph = createTaskGraph(
      projectGraph,
      {},
      ['app'],
      ['build', 'e2e', 'test', 'custom'],
      undefined,
      {}
    );
    return { projectGraph, taskGraph };
  }

  it('offers only tasks that might hash up front and assigns what the hasher returns', async () => {
    const { projectGraph, taskGraph } = graph();
    const hashTasksUpfront = vi.fn(async (tasks: { id: string }[]) => ({
      'app:build': hashOf('app:build'),
    }));
    await hashTasksThatDoNotDependOnOutputsOfOtherTasks(
      { hashTasksUpfront } as unknown as TaskHasher,
      projectGraph,
      taskGraph,
      nxJson,
      null
    );

    // app:e2e reads outputs through its own inputs, so it is never planned
    // up front; app:test's outputs hide behind ^production, so the hasher
    // must see it to defer it.
    expect(hashTasksUpfront.mock.calls[0][0].map((t) => t.id).sort()).toEqual([
      'app:build',
      'app:test',
    ]);
    expect(taskGraph.tasks['app:build'].hash).toBe('hash-app:build');
    expect(taskGraph.tasks['app:e2e'].hash).toBeUndefined();
    expect(taskGraph.tasks['app:test'].hash).toBeUndefined();
    expect(taskGraph.tasks['app:custom'].hash).toBeUndefined();
  });

  it('holds back a task whose snapshot reads producer outputs, even when its inputs never said so', async () => {
    const { projectGraph, taskGraph } = graph();
    deferredBySnapshot.ids = ['app:test'];
    const hashTasksUpfront = vi.fn(async () => ({}));
    await hashTasksThatDoNotDependOnOutputsOfOtherTasks(
      { hashTasksUpfront } as unknown as TaskHasher,
      projectGraph,
      taskGraph,
      nxJson,
      null,
      {} as any
    );
    deferredBySnapshot.ids = [];
    expect(hashTasksUpfront.mock.calls[0][0].map((t) => t.id)).toEqual([
      'app:build',
    ]);
  });
});
