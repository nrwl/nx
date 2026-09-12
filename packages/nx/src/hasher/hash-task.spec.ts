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

describe('hashTasksThatDoNotDependOnOutputsOfOtherTasks', () => {
  const nxJson = { namedInputs: { default: ['{projectRoot}/**/*'] } } as any;
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
          custom: { executor: 'nx:run-commands' },
        },
      },
    });
    const projectGraph = builder.getUpdatedProjectGraph();
    const taskGraph = createTaskGraph(
      projectGraph,
      {},
      ['app'],
      ['build', 'e2e', 'custom'],
      undefined,
      {}
    );
    return { projectGraph, taskGraph };
  }

  it('assigns the hashes the hasher returns and leaves the rest for run time', async () => {
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

    // Everything without a custom hasher is offered; the hasher decides.
    expect(hashTasksUpfront.mock.calls[0][0].map((t) => t.id).sort()).toEqual([
      'app:build',
      'app:e2e',
    ]);
    expect(taskGraph.tasks['app:build'].hash).toBe('hash-app:build');
    expect(taskGraph.tasks['app:e2e'].hash).toBeUndefined();
    expect(taskGraph.tasks['app:custom'].hash).toBeUndefined();
  });

  it('keeps a hasher without hashTasksUpfront to tasks that read no dependency outputs', async () => {
    const { projectGraph, taskGraph } = graph();
    const hashTasks = vi.fn(async (tasks: { id: string }[]) =>
      tasks.map((t) => hashOf(t.id))
    );
    await hashTasksThatDoNotDependOnOutputsOfOtherTasks(
      { hashTasks } as unknown as TaskHasher,
      projectGraph,
      taskGraph,
      nxJson,
      null
    );

    expect(hashTasks.mock.calls[0][0].map((t) => t.id)).toEqual(['app:build']);
    expect(taskGraph.tasks['app:build'].hash).toBe('hash-app:build');
    expect(taskGraph.tasks['app:e2e'].hash).toBeUndefined();
  });
});
