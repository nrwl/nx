import {
  clearTaskHash,
  hashTask,
  hashTasks,
  hashTasksThatDoNotDependOnOutputsOfOtherTasks,
} from './hash-task';
import type { Hash, TaskHasher } from './task-hasher';
import { ProjectGraphBuilder } from '../project-graph/project-graph-builder';
import { createTaskGraph } from '../tasks-runner/create-task-graph';

const customHash = vi.hoisted(() => vi.fn());
vi.mock('../tasks-runner/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../tasks-runner/utils')>()),
  getCustomHasher: (task: { target: { target: string } }) =>
    task.target.target === 'custom' ? customHash : null,
}));
// The real implementation reads the workspace's .env files.
vi.mock('../tasks-runner/task-env', () => ({
  getTaskSpecificEnv: () => ({}),
}));
const deferredByConfiguration = vi.hoisted(() => ({ ids: [] as string[] }));
vi.mock('../native', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../native')>()),
  getUltracacheDeferredTaskIds: () => deferredByConfiguration.ids,
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
    ultracacheHashing: {
      mode: 'on',
      usedDeclaredInputs: false,
      configDigest: 'digest',
      sourceCommit: 'source',
      fallbackReason: null,
    },
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
    const deferred = await hashTasksThatDoNotDependOnOutputsOfOtherTasks(
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
    expect(taskGraph.tasks['app:build'].ultracacheHashing).toEqual(
      hashOf('app:build').ultracacheHashing
    );
    expect(taskGraph.tasks['app:e2e'].hash).toBeUndefined();
    expect(taskGraph.tasks['app:test'].hash).toBeUndefined();
    expect(taskGraph.tasks['app:custom'].hash).toBeUndefined();
    expect([...deferred].sort()).toEqual(['app:custom', 'app:e2e', 'app:test']);
  });

  it('holds back a task whose Ultracache configuration reads producer outputs, even when its inputs never said so', async () => {
    const { projectGraph, taskGraph } = graph();
    deferredByConfiguration.ids = ['app:test'];
    const hashTasksUpfront = vi.fn(async () => ({}));
    await hashTasksThatDoNotDependOnOutputsOfOtherTasks(
      { hashTasksUpfront } as unknown as TaskHasher,
      projectGraph,
      taskGraph,
      nxJson,
      null,
      {} as any
    );
    deferredByConfiguration.ids = [];
    expect(hashTasksUpfront.mock.calls[0][0].map((t) => t.id)).toEqual([
      'app:build',
    ]);
  });
  it('carries batch and individual hash decisions and clears them before a failed rehash', async () => {
    const { projectGraph, taskGraph } = graph();
    const task = taskGraph.tasks['app:build'];
    const hasher = {
      hashTasks: vi.fn(async () => [hashOf(task.id)]),
      hashTask: vi.fn(async () => hashOf(task.id)),
    } as unknown as TaskHasher;
    await hashTasks(hasher, projectGraph, taskGraph, { [task.id]: {} }, null, [
      task,
    ]);
    expect(task.ultracacheHashing).toEqual(hashOf(task.id).ultracacheHashing);
    clearTaskHash(task);
    expect(task.hash).toBeUndefined();
    expect(task.hashDetails).toBeUndefined();
    expect(task.ultracacheHashing).toBeUndefined();
    await hashTask(hasher, projectGraph, taskGraph, task, {}, null);
    expect(task.ultracacheHashing).toEqual(hashOf(task.id).ultracacheHashing);
    vi.mocked(hasher.hashTask).mockRejectedValueOnce(new Error('hash failed'));
    await expect(
      hashTask(hasher, projectGraph, taskGraph, task, {}, null)
    ).rejects.toThrow('hash failed');
    expect(task.hash).toBeUndefined();
    expect(task.ultracacheHashing).toBeUndefined();
  });

  it.each(['single', 'batch'])(
    'records custom hashers at the %s decision without trusting delegated metadata',
    async (path) => {
      const { projectGraph, taskGraph } = graph();
      const task = taskGraph.tasks['app:custom'];
      task.ultracache = { mode: 'warn' };
      task.ultracacheHashing = hashOf(task.id).ultracacheHashing;
      customHash.mockImplementation(async () => {
        expect(task.ultracacheHashing).toBeUndefined();
        return hashOf(task.id);
      });
      if (path === 'single') {
        await hashTask(
          {} as TaskHasher,
          projectGraph,
          taskGraph,
          task,
          {},
          null
        );
      } else {
        await hashTasks(
          {} as TaskHasher,
          projectGraph,
          taskGraph,
          { [task.id]: {} },
          null,
          [task]
        );
      }
      expect(task.ultracacheHashing).toEqual({
        mode: 'warn',
        usedDeclaredInputs: true,
        configDigest: null,
        sourceCommit: null,
        fallbackReason: 'custom-hasher',
      });
    }
  );

  it('leaves metadata unknown when an older hasher does not return it', async () => {
    const { projectGraph, taskGraph } = graph();
    const task = taskGraph.tasks['app:build'];
    task.ultracacheHashing = hashOf(task.id).ultracacheHashing;
    const hasher = {
      hashTask: async () => ({ value: 'old', details: {} }),
    } as TaskHasher;
    await hashTask(hasher, projectGraph, taskGraph, task, {}, null);
    expect(task.hash).toBe('old');
    expect(task.ultracacheHashing).toBeUndefined();
  });
});
