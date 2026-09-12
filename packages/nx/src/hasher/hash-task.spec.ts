import { hashTasksThatDoNotDependOnOutputsOfOtherTasks } from './hash-task';
import type { TaskHasher } from './task-hasher';
import { ProjectGraphBuilder } from '../project-graph/project-graph-builder';
import { createTaskGraph } from '../tasks-runner/create-task-graph';

vi.mock('../tasks-runner/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../tasks-runner/utils')>()),
  getCustomHasher: () => null,
}));
// The real implementation reads the workspace's .env files.
vi.mock('../tasks-runner/task-env', () => ({
  getTaskSpecificEnv: () => ({}),
}));

describe('hashTasksThatDoNotDependOnOutputsOfOtherTasks', () => {
  const nxJson = {
    namedInputs: { default: ['{projectRoot}/**/*'] },
  } as any;

  function graphWithServer(serveInputs: unknown[]) {
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
          serve: {
            executor: 'nx:run-commands',
            continuous: true,
            dependsOn: ['build'],
            inputs: serveInputs,
          },
        },
      },
    });
    builder.addNode({
      name: 'e2e',
      type: 'app',
      data: {
        root: 'apps/e2e',
        targets: {
          e2e: {
            executor: 'nx:run-commands',
            dependsOn: [{ projects: 'app', target: 'serve' }],
          },
        },
      },
    });
    builder.addNode({
      name: 'other',
      type: 'lib',
      data: {
        root: 'libs/other',
        targets: { test: { executor: 'nx:run-commands' } },
      },
    });
    const projectGraph = builder.getUpdatedProjectGraph();
    const taskGraph = createTaskGraph(
      projectGraph,
      {},
      ['e2e', 'other'],
      ['e2e', 'test'],
      undefined,
      {}
    );
    return { projectGraph, taskGraph };
  }

  async function eagerlyHashed(serveInputs: unknown[]) {
    const { projectGraph, taskGraph } = graphWithServer(serveInputs);
    const hashTasks = vi.fn(async (tasks: { id: string }[]) =>
      tasks.map(() => ({ value: 'hash', details: {} as any }))
    );
    await hashTasksThatDoNotDependOnOutputsOfOtherTasks(
      { hashTasks } as unknown as TaskHasher,
      projectGraph,
      taskGraph,
      nxJson,
      null
    );
    return hashTasks.mock.calls[0][0].map((t) => t.id).sort();
  }

  it('defers a task whose continuous dependency reads the outputs of its own dependencies', async () => {
    const eager = await eagerlyHashed([
      '{projectRoot}/**/*',
      { dependentTasksOutputFiles: '**/*.d.ts', transitive: true },
    ]);

    // app:serve waits for app:build as it always did; e2e:e2e now waits too,
    // since its hash carries app:serve's dependentTasksOutputFiles.
    expect(eager).toEqual(['app:build', 'other:test']);
  });

  it('hashes a served task eagerly when its continuous dependency declares no outputs of other tasks', async () => {
    const eager = await eagerlyHashed(['{projectRoot}/**/*']);

    expect(eager).toEqual(['app:build', 'app:serve', 'e2e:e2e', 'other:test']);
  });
});
