import type { ExecutorContext, TaskGraph } from '@nx/devkit';
import { rmSync } from 'fs';
import { updatePackageJson } from '../../utils/package-json/update-package-json';
import type { ExecutorOptions } from '../../utils/schema';
import type { TaskInfo } from './lib/batch';
import {
  buildTaskInfoPerTsConfigMap,
  compileBatchTypescript,
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

  const tsConfigTaskInfoMap: Record<string, TaskInfo> = {};
  buildTaskInfoPerTsConfigMap(
    tsConfigTaskInfoMap,
    tasksOptions,
    context,
    Object.keys(taskGraph.tasks),
    shouldWatch
  );

  const typescriptCompilation = compileBatchTypescript(
    tsConfigTaskInfoMap,
    taskGraph,
    shouldWatch,
    (taskInfo) => {
      taskInfo.assetsHandler.processAllAssetsOnceSync();
      updatePackageJson(
        taskInfo.options,
        taskInfo.context,
        taskInfo.projectGraphNode,
        taskInfo.buildableProjectNodeDependencies
      );
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
      await typescriptCompilation.close();
      watchAssetsChangesDisposer();
      watchProjectsChangesDisposer();
      process.exit(exitCode);
    };
    process.on('SIGINT', () => handleTermination(128 + 2));
    process.on('SIGTERM', () => handleTermination(128 + 15));
  }

  return yield* typescriptCompilation.iterator;
}

export default tscBatchExecutor;
