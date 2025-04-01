import { TasksRunner, TaskStatus } from './tasks-runner';
import { TaskOrchestrator } from './task-orchestrator';
import { TaskHasher } from '../hasher/task-hasher';
import { LifeCycle } from './life-cycle';
import { ProjectGraph } from '../config/project-graph';
import { NxJsonConfiguration } from '../config/nx-json';
import { Task, TaskGraph } from '../config/task-graph';
import { NxArgs } from '../utils/command-line-utils';
import { DaemonClient } from '../daemon/client/client';
import { cacheDir } from '../utils/cache-directory';
import { readFile, writeFile, mkdir, rename, readdir } from 'fs/promises';
import { join } from 'path';
import { CachedResult } from '../native';

export interface RemoteCache {
  retrieve: (hash: string, cacheDirectory: string) => Promise<boolean>;
  store: (hash: string, cacheDirectory: string) => Promise<boolean>;
}

export abstract class RemoteCacheV2 {
  static async fromCacheV1(cache: RemoteCache): Promise<RemoteCacheV2> {
    await mkdir(join(cacheDir, 'terminalOutputs'), { recursive: true });

    return {
      retrieve: async (hash, cacheDirectory) => {
        const res = await cache.retrieve(hash, cacheDirectory);
        if (res) {
          const [terminalOutput, oldTerminalOutput, code] = await Promise.all([
            readFile(
              join(cacheDirectory, hash, 'terminalOutputs'),
              'utf-8'
            ).catch(() => null),
            readFile(join(cacheDir, 'terminalOutputs', hash), 'utf-8').catch(
              () => null
            ),
            readFile(join(cacheDirectory, hash, 'code'), 'utf-8').then(
              (s) => +s
            ),
          ]);
          return {
            outputsPath: join(cacheDirectory, hash, 'outputs'),
            terminalOutput: terminalOutput ?? oldTerminalOutput,
            code,
          };
        } else {
          return null;
        }
      },
      store: async (hash, cacheDirectory, terminalOutput, code) => {
        // The new db cache places the outputs directly into the cacheDirectory + hash.
        // old instances of Nx Cloud expect these outputs to be in cacheDirectory + hash + outputs
        // this ensures that everything that was in the cache directory is moved to the outputs directory
        const cacheDir = join(cacheDirectory, hash);
        const outputDir = join(cacheDir, 'outputs');
        await mkdir(outputDir, { recursive: true });
        const files = await readdir(cacheDir);
        await Promise.all(
          files.map(async (file) => {
            const filePath = join(cacheDir, file);
            // we don't want to move these files to the outputs directory because they are not artifacts of the task
            if (
              filePath === outputDir ||
              file === 'code' ||
              file === 'terminalOutput'
            ) {
              return;
            }
            await rename(filePath, join(outputDir, file));
          })
        );

        await writeFile(join(cacheDirectory, hash, 'code'), code.toString());
        await writeFile(
          join(cacheDirectory, hash, 'terminalOutput'),
          terminalOutput
        );

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
  skipRemoteCache?: boolean;
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

  const threadCount =
    (options as any)['parallel'] +
    Object.values(context.taskGraph.tasks).filter((t) => t.continuous).length;

  await options.lifeCycle.startCommand(threadCount);
  try {
    return await runAllTasks(options, {
      ...context,
      threadCount,
    });
  } finally {
    await options.lifeCycle.endCommand();
  }
};

async function runAllTasks(
  options: DefaultTasksRunnerOptions,
  context: {
    initiatingProject?: string;
    projectGraph: ProjectGraph;
    nxJson: NxJsonConfiguration;
    nxArgs: NxArgs;
    taskGraph: TaskGraph;
    hasher: TaskHasher;
    daemon: DaemonClient;
    threadCount: number;
  }
): Promise<{ [id: string]: TaskStatus }> {
  const orchestrator = new TaskOrchestrator(
    context.hasher,
    context.initiatingProject,
    context.projectGraph,
    context.taskGraph,
    context.nxJson,
    options,
    context.threadCount,
    context.nxArgs?.nxBail,
    context.daemon,
    context.nxArgs?.outputStyle
  );

  return orchestrator.run();
}

export default defaultTasksRunner;
