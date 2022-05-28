import { TasksRunner, TaskStatus } from './tasks-runner';
import { TaskOrchestrator } from './task-orchestrator';
import { performance } from 'perf_hooks';
import { TaskGraphCreator } from './task-graph-creator';
import { Hasher } from '../hasher/hasher';
import { LifeCycle } from './life-cycle';
import { ProjectGraph } from '../config/project-graph';
import { NxJsonConfiguration } from '../config/nx-json';
import { Task } from '../config/task-graph';
import { NxArgs } from '../utils/command-line-utils';

export interface RemoteCache {
  retrieve: (hash: string, cacheDirectory: string) => Promise<boolean>;
  store: (hash: string, cacheDirectory: string) => Promise<boolean>;
}

export interface DefaultTasksRunnerOptions {
  parallel?: number;
  cacheableOperations?: string[];
  cacheableTargets?: string[];
  runtimeCacheInputs?: string[];
  cacheDirectory?: string;
  remoteCache?: RemoteCache;
  lifeCycle: LifeCycle;
  captureStderr?: boolean;
  skipNxCache?: boolean;
}

export const defaultTasksRunner: TasksRunner<
  DefaultTasksRunnerOptions
> = async (
  tasks: Task[],
  options: DefaultTasksRunnerOptions,
  context: {
    target: string;
    initiatingProject?: string;
    projectGraph: ProjectGraph;
    nxJson: NxJsonConfiguration;
    nxArgs: NxArgs;
  }
): Promise<{ [id: string]: TaskStatus }> => {
  if (
    (options as any)['parallel'] === 'false' ||
    (options as any)['parallel'] === false
  ) {
    (options as any)['parallel'] = 1;
  } else if (
    (options as any)['parallel'] === 'true' ||
    (options as any)['parallel'] === true ||
    (options as any)['parallel'] === undefined
  ) {
    (options as any)['parallel'] = Number((options as any)['maxParallel'] || 3);
  }

  options.lifeCycle.startCommand();
  try {
    return await runAllTasks(tasks, options, context);
  } catch (e) {
    console.error('Unexpected error:');
    console.error(e);
    process.exit(1);
  } finally {
    options.lifeCycle.endCommand();
  }
};

async function runAllTasks(
  tasks: Task[],
  options: DefaultTasksRunnerOptions,
  context: {
    initiatingProject?: string;
    projectGraph: ProjectGraph;
    nxJson: NxJsonConfiguration;
    nxArgs: NxArgs;
  }
): Promise<{ [id: string]: TaskStatus }> {
  const defaultTargetDependencies = context.nxJson.targetDependencies ?? {};

  const taskGraphCreator = new TaskGraphCreator(
    context.projectGraph,
    defaultTargetDependencies
  );

  const taskGraph = taskGraphCreator.createTaskGraph(tasks);

  performance.mark('task-graph-created');

  performance.measure('nx-prep-work', 'init-local', 'task-graph-created');
  performance.measure(
    'graph-creation',
    'command-execution-begins',
    'task-graph-created'
  );

  const hasher = new Hasher(context.projectGraph, context.nxJson, options);

  const orchestrator = new TaskOrchestrator(
    hasher,
    context.initiatingProject,
    context.projectGraph,
    taskGraph,
    options,
    context.nxArgs?.nxBail
  );

  return orchestrator.run();
}

export default defaultTasksRunner;
