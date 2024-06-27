import {
  ExecutorContext,
  isDaemonEnabled,
  output,
  parseTargetString,
  TaskGraph,
} from '@nx/devkit';
import { rmSync } from 'fs';
import type { BatchExecutorTaskResult } from 'nx/src/config/misc-interfaces';
import { getLastValueFromAsyncIterableIterator } from 'nx/src/utils/async-iterator';
import { updatePackageJson } from '../../utils/package-json/update-package-json';
import type { ExecutorOptions } from '../../utils/schema';
import { determineModuleFormatFromTsConfig } from './tsc.impl';
import {
  compileTypescriptSolution,
  getProcessedTaskTsConfigs,
  TypescripCompilationLogger,
  TypescriptCompilationResult,
  TypescriptInMemoryTsConfig,
  TypescriptProjectContext,
} from './lib';
import {
  createTaskInfoPerTsConfigMap,
  normalizeTasksOptions,
  TaskInfo,
  watchTaskProjectsFileChangesForAssets,
  watchTaskProjectsPackageJsonFileChanges,
} from './lib/batch';
import { createEntryPoints } from '../../utils/package-json/create-entry-points';

export async function* tscBatchExecutor(
  taskGraph: TaskGraph,
  inputs: Record<string, ExecutorOptions>,
  overrides: ExecutorOptions,
  context: ExecutorContext
) {
  const tasksOptions = normalizeTasksOptions(inputs, context);

  let shouldWatch = false;
  Object.values(tasksOptions).forEach((taskOptions) => {
    if (taskOptions.clean) {
      rmSync(taskOptions.outputPath, { force: true, recursive: true });
    }
    if (taskOptions.watch) {
      shouldWatch = true;
    }
  });

  const taskInMemoryTsConfigMap = getProcessedTaskTsConfigs(
    Object.keys(taskGraph.tasks),
    tasksOptions,
    context
  );
  const tsConfigTaskInfoMap = createTaskInfoPerTsConfigMap(
    tasksOptions,
    context,
    Object.keys(taskGraph.tasks),
    taskInMemoryTsConfigMap
  );
  const tsCompilationContext = createTypescriptCompilationContext(
    tsConfigTaskInfoMap,
    taskInMemoryTsConfigMap,
    context
  );

  const logger: TypescripCompilationLogger = {
    error: (message, tsConfig) => {
      process.stderr.write(message);
      if (tsConfig) {
        tsConfigTaskInfoMap[tsConfig].terminalOutput += message;
      }
    },
    info: (message, tsConfig) => {
      process.stdout.write(message);
      if (tsConfig) {
        tsConfigTaskInfoMap[tsConfig].terminalOutput += message;
      }
    },
    warn: (message, tsConfig) => {
      process.stdout.write(message);
      if (tsConfig) {
        tsConfigTaskInfoMap[tsConfig].terminalOutput += message;
      }
    },
  };

  const processTaskPostCompilation = (tsConfig: string) => {
    if (tsConfigTaskInfoMap[tsConfig]) {
      const taskInfo = tsConfigTaskInfoMap[tsConfig];
      taskInfo.assetsHandler.processAllAssetsOnceSync();
      updatePackageJson(
        {
          ...taskInfo.options,
          additionalEntryPoints: createEntryPoints(
            taskInfo.options.additionalEntryPoints,
            context.root
          ),
          format: [determineModuleFormatFromTsConfig(tsConfig)],
          // As long as d.ts files match their .js counterparts, we don't need to emit them.
          // TSC can match them correctly based on file names.
          skipTypings: true,
        },
        taskInfo.context,
        taskInfo.projectGraphNode,
        taskInfo.buildableProjectNodeDependencies
      );
      taskInfo.endTime = Date.now();
    }
  };

  const typescriptCompilation = compileTypescriptSolution(
    tsCompilationContext,
    shouldWatch,
    logger,
    {
      beforeProjectCompilationCallback: (tsConfig) => {
        if (tsConfigTaskInfoMap[tsConfig]) {
          tsConfigTaskInfoMap[tsConfig].startTime = Date.now();
        }
      },
      afterProjectCompilationCallback: processTaskPostCompilation,
    }
  );
  if (shouldWatch && !isDaemonEnabled()) {
    output.warn({
      title:
        'Nx Daemon is not enabled. Assets and package.json files will not be updated on file changes.',
    });
  }
  if (shouldWatch && isDaemonEnabled()) {
    const taskInfos = Object.values(tsConfigTaskInfoMap);
    const watchAssetsChangesDisposer =
      await watchTaskProjectsFileChangesForAssets(taskInfos);
    const watchProjectsChangesDisposer =
      await watchTaskProjectsPackageJsonFileChanges(
        taskInfos,
        (changedTaskInfos: TaskInfo[]) => {
          for (const t of changedTaskInfos) {
            updatePackageJson(
              {
                ...t.options,
                additionalEntryPoints: createEntryPoints(
                  t.options.additionalEntryPoints,
                  context.root
                ),
                format: [determineModuleFormatFromTsConfig(t.options.tsConfig)],
                // As long as d.ts files match their .js counterparts, we don't need to emit them.
                // TSC can match them correctly based on file names.
                skipTypings: true,
              },
              t.context,
              t.projectGraphNode,
              t.buildableProjectNodeDependencies
            );
          }
        }
      );

    const handleTermination = async (exitCode: number) => {
      watchAssetsChangesDisposer();
      watchProjectsChangesDisposer();
      process.exit(exitCode);
    };
    process.on('SIGINT', () => handleTermination(128 + 2));
    process.on('SIGTERM', () => handleTermination(128 + 15));

    return yield* mapAsyncIterable(typescriptCompilation, async (iterator) => {
      // drain the iterator, we don't use the results
      await getLastValueFromAsyncIterableIterator(iterator);
      return { value: undefined, done: true };
    });
  }

  const toBatchExecutorTaskResult = (
    tsConfig: string,
    success: boolean
  ): BatchExecutorTaskResult => ({
    task: tsConfigTaskInfoMap[tsConfig].task,
    result: {
      success: success,
      terminalOutput: tsConfigTaskInfoMap[tsConfig].terminalOutput,
      startTime: tsConfigTaskInfoMap[tsConfig].startTime,
      endTime: tsConfigTaskInfoMap[tsConfig].endTime,
    },
  });

  let isCompilationDone = false;
  const taskTsConfigsToReport = new Set(
    Object.keys(taskGraph.tasks).map((t) => taskInMemoryTsConfigMap[t].path)
  );
  let tasksToReportIterator: IterableIterator<string>;

  const processSkippedTasks = () => {
    const { value: tsConfig, done } = tasksToReportIterator.next();
    if (done) {
      return { value: undefined, done: true };
    }

    tsConfigTaskInfoMap[tsConfig].startTime = Date.now();
    processTaskPostCompilation(tsConfig);

    return { value: toBatchExecutorTaskResult(tsConfig, true), done: false };
  };

  return yield* mapAsyncIterable(typescriptCompilation, async (iterator) => {
    if (isCompilationDone) {
      return processSkippedTasks();
    }

    const { value, done } = await iterator.next();
    if (done) {
      if (taskTsConfigsToReport.size > 0) {
        /**
         * TS compilation is done but we still have tasks to report. This can
         * happen if, for example, a project is identified as affected, but
         * no file in the TS project is actually changed or if running a
         * task with `--skip-nx-cache` and the outputs are already there. There
         * can still be changes to assets or other files we need to process.
         *
         * Switch to handle the iterator for the tasks we still need to report.
         */
        isCompilationDone = true;
        tasksToReportIterator = taskTsConfigsToReport.values();
        return processSkippedTasks();
      }

      return { value: undefined, done: true };
    }

    taskTsConfigsToReport.delete(value.tsConfig);

    return {
      value: toBatchExecutorTaskResult(value.tsConfig, value.success),
      done: false,
    };
  });
}

export default tscBatchExecutor;

async function* mapAsyncIterable(
  iterable: AsyncIterable<TypescriptCompilationResult>,
  nextFn: (
    iterator: AsyncIterableIterator<TypescriptCompilationResult>
  ) => Promise<IteratorResult<BatchExecutorTaskResult>>
) {
  return yield* {
    [Symbol.asyncIterator]() {
      const iterator: AsyncIterableIterator<TypescriptCompilationResult> =
        iterable[Symbol.asyncIterator].call(iterable);

      return {
        async next() {
          return await nextFn(iterator);
        },
      };
    },
  };
}

function createTypescriptCompilationContext(
  tsConfigTaskInfoMap: Record<string, TaskInfo>,
  taskInMemoryTsConfigMap: Record<string, TypescriptInMemoryTsConfig>,
  context: ExecutorContext
): Record<string, TypescriptProjectContext> {
  const tsCompilationContext: Record<string, TypescriptProjectContext> =
    Object.entries(tsConfigTaskInfoMap).reduce((acc, [tsConfig, taskInfo]) => {
      acc[tsConfig] = {
        project: taskInfo.context.projectName,
        tsConfig: taskInfo.tsConfig,
        transformers: taskInfo.options.transformers,
      };
      return acc;
    }, {} as Record<string, TypescriptProjectContext>);

  Object.entries(taskInMemoryTsConfigMap).forEach(([task, tsConfig]) => {
    if (!tsCompilationContext[tsConfig.path]) {
      tsCompilationContext[tsConfig.path] = {
        project: parseTargetString(task, context).project,
        transformers: [],
        tsConfig: tsConfig,
      };
    }
  });

  return tsCompilationContext;
}
