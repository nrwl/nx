import { TasksRunner, TaskStatus } from './tasks-runner';
import { TaskOrchestrator } from './task-orchestrator';
import { TaskHasher } from '../hasher/task-hasher';
import { LifeCycle } from './life-cycle';
import { ProjectGraph } from '../config/project-graph';
import { NxJsonConfiguration } from '../config/nx-json';
import { Task, TaskGraph } from '../config/task-graph';
import { NxArgs } from '../utils/command-line-utils';
import { DaemonClient } from '../daemon/client/client';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { CachedResult } from '../native';

export interface RemoteCache {
  retrieve: (hash: string, cacheDirectory: string) => Promise<boolean>;
  store: (hash: string, cacheDirectory: string) => Promise<boolean>;
}

export abstract class RemoteCacheV2 {
  static fromCacheV1(cache: RemoteCache): RemoteCacheV2 {
    return {
      retrieve: async (hash, cacheDirectory) => {
        const res = cache.retrieve(hash, cacheDirectory);
        const [terminalOutput, code] = await Promise.all([
          readFile(join(cacheDirectory, hash, 'terminalOutputs'), 'utf-8'),
          readFile(join(cacheDirectory, hash, 'code'), 'utf-8').then((s) => +s),
        ]);
        if (res) {
          return {
            outputsPath: cacheDirectory,
            terminalOutput,
            code,
          };
        } else {
          return null;
        }
      },
      store: async (hash, cacheDirectory, __, code) => {
        await writeFile(join(cacheDirectory, hash, 'code'), code.toString());

        return cache.store(hash, cacheDirectory);
      },
    };
  }
  abstract retrieve(
    hash: string,
    cacheDirectory: string
  ): Promise<CachedResult | null>;
  abstract store(
    hash: string,
    cacheDirectory: string,
    terminalOutput: string,
    code: number
  ): Promise<boolean>;
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
  batch?: boolean;
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
    hasher: TaskHasher;
    daemon: DaemonClient;
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
    (options as any)['parallel'] === undefined ||
    (options as any)['parallel'] === ''
  ) {
    (options as any)['parallel'] = Number((options as any)['maxParallel'] || 3);
  }

  await options.lifeCycle.startCommand();
  try {
    return await runAllTasks(tasks, options, context);
  } finally {
    await options.lifeCycle.endCommand();
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
    hasher: TaskHasher;
    daemon: DaemonClient;
  }
): Promise<{ [id: string]: TaskStatus }> {
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
