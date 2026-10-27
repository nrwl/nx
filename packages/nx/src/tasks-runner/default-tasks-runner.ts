import { TasksRunner, TaskStatus } from './tasks-runner';
import { getThreadPoolSize, TaskOrchestrator } from './task-orchestrator';
import { TaskHasher } from '../hasher/task-hasher';
import { LifeCycle } from './life-cycle';
import { getPerformanceReport } from './life-cycles/performance-life-cycle';
import { ProjectGraph } from '../config/project-graph';
import { NxJsonConfiguration } from '../config/nx-json';
import { Task, TaskGraph } from '../config/task-graph';
import { NxArgs } from '../utils/command-line-utils';
import { DaemonClient } from '../daemon/client/client';
import { cacheDir } from '../utils/cache-directory';
import {
  lstat,
  readFile,
  writeFile,
  mkdir,
  rename,
  readdir,
} from 'fs/promises';
import { join } from 'path';
import { CachedResult } from '../native';

export interface RemoteCache {
  retrieve: (hash: string, cacheDirectory: string) => Promise<boolean>;
  store: (hash: string, cacheDirectory: string) => Promise<boolean>;
}

async function readRegularFile(path: string): Promise<string | null> {
  const stats = await lstat(path).catch(() => null);
  return stats?.isFile() ? readFile(path, 'utf-8') : null;
}

export abstract class RemoteCacheV2 {
  static async fromCacheV1(cache: RemoteCache): Promise<RemoteCacheV2> {
    await mkdir(join(cacheDir, 'terminalOutputs'), { recursive: true });

    return {
      retrieve: async (hash, cacheDirectory) => {
        if (!(await cache.retrieve(hash, cacheDirectory))) {
          return null;
        }
        const entry = join(cacheDirectory, hash);
        const [outputs, terminalOutputs, code] = await Promise.all(
          ['outputs', 'terminalOutputs', 'code'].map((name) =>
            lstat(join(entry, name)).catch(() => null)
          )
        );
        if (
          (outputs && !outputs.isDirectory()) ||
          (terminalOutputs && !terminalOutputs.isFile()) ||
          !code?.isFile()
        ) {
          return null;
        }
        const [terminalOutput, oldTerminalOutput, exitCode] = await Promise.all(
          [
            terminalOutputs
              ? readFile(join(entry, 'terminalOutputs'), 'utf-8')
              : null,
            readRegularFile(join(cacheDir, 'terminalOutputs', hash)),
            readFile(join(entry, 'code'), 'utf-8'),
          ]
        );
        return {
          outputsPath: join(entry, 'outputs'),
          terminalOutput: terminalOutput ?? oldTerminalOutput,
          code: +exitCode,
        };
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
    initiatingTasks: Task[];
    projectGraph: ProjectGraph;
    nxJson: NxJsonConfiguration;
    nxArgs: NxArgs;
    taskGraph: TaskGraph;
    hasher: TaskHasher;
    daemon: DaemonClient;
    hashingDeferredTaskIds?: ReadonlySet<string>;
  }
): Promise<{ [id: string]: TaskStatus }> => {
  const { total: threadCount, discrete } = getThreadPoolSize(
    options,
    context.taskGraph
  );
  // Total thread count drives the TUI; the discrete `--parallel` feeds the perf report.
  await options.lifeCycle.startCommand(threadCount, discrete);
  try {
    return await runAllTasks(options, context);
  } finally {
    // Hand the TUI exit popup the perf report (multi-task TUI runs); other modes flush it.
    await options.lifeCycle.endCommand(getPerformanceReport(tasks.length));
  }
};

async function runAllTasks(
  options: DefaultTasksRunnerOptions,
  context: {
    initiatingProject?: string;
    initiatingTasks: Task[];
    projectGraph: ProjectGraph;
    nxJson: NxJsonConfiguration;
    nxArgs: NxArgs;
    taskGraph: TaskGraph;
    hasher: TaskHasher;
    daemon: DaemonClient;
    hashingDeferredTaskIds?: ReadonlySet<string>;
  }
): Promise<{ [id: string]: TaskStatus }> {
  const orchestrator = new TaskOrchestrator(
    context.hasher,
    context.initiatingProject,
    context.initiatingTasks,
    context.projectGraph,
    context.taskGraph,
    context.nxJson,
    options,
    context.nxArgs?.nxBail,
    context.daemon,
    context.nxArgs?.specifiedOutputStyle,
    context.nxArgs?.resolvedOutputStyle ?? 'static-failures-only',
    context.taskGraph,
    context.hashingDeferredTaskIds
  );

  return orchestrator.run();
}

export default defaultTasksRunner;
