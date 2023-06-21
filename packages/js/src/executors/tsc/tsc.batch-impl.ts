import { ExecutorContext, TaskGraph, parseTargetString } from '@nx/devkit';
import { rmSync } from 'fs';
import type { BatchExecutorTaskResult } from 'nx/src/config/misc-interfaces';
import { getLastValueFromAsyncIterableIterator } from 'nx/src/utils/async-iterator';
import { updatePackageJson } from '../../utils/package-json/update-package-json';
import type { ExecutorOptions } from '../../utils/schema';
import {
  TypescripCompilationLogger,
  TypescriptCompilationResult,
  TypescriptInMemoryTsConfig,
  TypescriptProjectContext,
  compileTypescriptSolution,
  getProcessedTaskTsConfigs,
} from './lib';
import {
  TaskInfo,
  createTaskInfoPerTsConfigMap,
  normalizeTasksOptions,
  watchTaskProjectsFileChangesForAssets,
  watchTaskProjectsPackageJsonFileChanges,
} from './lib/batch';

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
      afterProjectCompilationCallback: (tsConfig) => {
        if (tsConfigTaskInfoMap[tsConfig]) {
          const taskInfo = tsConfigTaskInfoMap[tsConfig];
          taskInfo.assetsHandler.processAllAssetsOnceSync();
          updatePackageJson(
            taskInfo.options,
            taskInfo.context,
            taskInfo.projectGraphNode,
            taskInfo.buildableProjectNodeDependencies
          );
          taskInfo.endTime = Date.now();
        }
      },
    }
  );

  if (shouldWatch) {
    const taskInfos = Object.values(tsConfigTaskInfoMap);
    const watchAssetsChangesDisposer =
      await watchTaskProjectsFileChangesForAssets(taskInfos);
    const watchProjectsChangesDisposer =
      await watchTaskProjectsPackageJsonFileChanges(
        taskInfos,
        (changedTaskInfos: TaskInfo[]) => {
          for (const t of changedTaskInfos) {
            updatePackageJson(
              t.options,
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

  return yield* mapAsyncIterable(typescriptCompilation, async (iterator) => {
    const { value, done } = await iterator.next();
    if (done) {
      return { value, done: true };
    }

    const taskResult: BatchExecutorTaskResult = {
      task: tsConfigTaskInfoMap[value.tsConfig].task,
      result: {
        success: value.success,
        terminalOutput: tsConfigTaskInfoMap[value.tsConfig].terminalOutput,
        startTime: tsConfigTaskInfoMap[value.tsConfig].startTime,
        endTime: tsConfigTaskInfoMap[value.tsConfig].endTime,
      },
    };

    return { value: taskResult, done: false };
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
        project: parseTargetString(task, context.projectGraph).project,
        transformers: [],
        tsConfig: tsConfig,
      };
    }
  });

  return tsCompilationContext;
}
