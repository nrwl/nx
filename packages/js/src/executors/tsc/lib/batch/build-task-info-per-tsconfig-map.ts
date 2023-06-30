import type { ExecutorContext } from '@nx/devkit';
import { parseTargetString } from '@nx/devkit';
import { join, relative } from 'path';
import { CopyAssetsHandler } from '../../../../utils/assets/copy-assets-handler';
import { calculateProjectDependencies } from '../../../../utils/buildable-libs-utils';
import type { NormalizedExecutorOptions } from '../../../../utils/schema';
import { getTaskWithTscExecutorOptions } from '../get-task-options';
import type { TypescriptInMemoryTsConfig } from '../typescript-compilation';
import type { TaskInfo } from './types';

const taskTsConfigCache = new Set<string>();

export function createTaskInfoPerTsConfigMap(
  tasksOptions: Record<string, NormalizedExecutorOptions>,
  context: ExecutorContext,
  tasks: string[],
  taskInMemoryTsConfigMap: Record<string, TypescriptInMemoryTsConfig>
): Record<string, TaskInfo> {
  const tsConfigTaskInfoMap: Record<string, TaskInfo> = {};

  processTasksAndPopulateTsConfigTaskInfoMap(
    tsConfigTaskInfoMap,
    tasksOptions,
    context,
    tasks,
    taskInMemoryTsConfigMap
  );

  return tsConfigTaskInfoMap;
}

function processTasksAndPopulateTsConfigTaskInfoMap(
  tsConfigTaskInfoMap: Record<string, TaskInfo>,
  tasksOptions: Record<string, NormalizedExecutorOptions>,
  context: ExecutorContext,
  tasks: string[],
  taskInMemoryTsConfigMap: Record<string, TypescriptInMemoryTsConfig>
): void {
  for (const taskName of tasks) {
    if (taskTsConfigCache.has(taskName)) {
      continue;
    }

    const tsConfig = taskInMemoryTsConfigMap[taskName];
    if (!tsConfig) {
      continue;
    }

    let taskOptions =
      tasksOptions[taskName] ??
      getTaskWithTscExecutorOptions(taskName, context);
    if (taskOptions) {
      const taskInfo = createTaskInfo(taskName, taskOptions, context, tsConfig);
      const tsConfigPath = join(
        context.root,
        relative(context.root, taskOptions.tsConfig)
      ).replace(/\\/g, '/');

      tsConfigTaskInfoMap[tsConfigPath] = taskInfo;
      taskTsConfigCache.add(taskName);
    }

    processTasksAndPopulateTsConfigTaskInfoMap(
      tsConfigTaskInfoMap,
      tasksOptions,
      context,
      context.taskGraph.dependencies[taskName],
      taskInMemoryTsConfigMap
    );
  }
}

function createTaskInfo(
  taskName: string,
  taskOptions: NormalizedExecutorOptions,
  context: ExecutorContext,
  tsConfig: TypescriptInMemoryTsConfig
): TaskInfo {
  const target = parseTargetString(taskName, context.projectGraph);

  const taskContext = {
    ...context,
    // batch executors don't get these in the context, we provide them
    // here per task
    projectName: target.project,
    targetName: target.target,
    configurationName: target.configuration,
  };

  const assetsHandler = new CopyAssetsHandler({
    projectDir: taskOptions.projectRoot,
    rootDir: context.root,
    outputDir: taskOptions.outputPath,
    assets: taskOptions.assets,
  });

  const {
    target: projectGraphNode,
    dependencies: buildableProjectNodeDependencies,
  } = calculateProjectDependencies(
    context.projectGraph,
    context.root,
    context.taskGraph.tasks[taskName].target.project,
    context.taskGraph.tasks[taskName].target.target,
    context.taskGraph.tasks[taskName].target.configuration
  );

  return {
    task: taskName,
    options: taskOptions,
    context: taskContext,
    assetsHandler,
    buildableProjectNodeDependencies,
    projectGraphNode,
    tsConfig,
    terminalOutput: '',
  };
}
