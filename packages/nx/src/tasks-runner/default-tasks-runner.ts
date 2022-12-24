import { TasksRunner, TaskStatus } from './tasks-runner';
import { TaskOrchestrator } from './task-orchestrator';
import { performance } from 'perf_hooks';
import { Hasher } from '../hasher/hasher';
import { LifeCycle } from './life-cycle';
import { ProjectGraph } from '../config/project-graph';
import { NxJsonConfiguration } from '../config/nx-json';
import { Task, TaskGraph } from '../config/task-graph';
import { NxArgs } from '../utils/command-line-utils';
import { DaemonClient } from '../daemon/client/client';

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
  loadDotEnvFiles?: boolean;
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
    taskGraph: TaskGraph;
    hasher: Hasher;
    daemon: DaemonClient;
  }
): Promise<{ [id: string]: TaskStatus }> => {
  // Override the Nx env var NX_LOAD_DOT_ENV_FILES
  // so that the executor can respect this env var
  // to determine if env vars should be loaded.
  if (options.loadDotEnvFiles === false) {
    process.env.NX_LOAD_DOT_ENV_FILES = 'false';
  }

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
    if (tasks.length) {
      return await runAllTasks(tasks, options, context);
    } else {
      return {};
    }
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
    taskGraph: TaskGraph;
    hasher: Hasher;
    daemon: DaemonClient;
  }
): Promise<{ [id: string]: TaskStatus }> {
  // TODO: vsavkin: remove this after Nx 16
  performance.mark('task-graph-created');

  performance.measure('nx-prep-work', 'init-local', 'task-graph-created');
  performance.measure(
    'graph-creation',
    'command-execution-begins',
    'task-graph-created'
  );

  const orchestrator = new TaskOrchestrator(
    context.hasher,
    context.initiatingProject,
    context.projectGraph,
    context.taskGraph,
    options,
    context.nxArgs?.nxBail,
    context.daemon
  );

  return orchestrator.run();
}

export default defaultTasksRunner;
