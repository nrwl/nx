import type { ExecutorContext } from '@nx/devkit';
import { parseTargetString } from '@nx/devkit';
import { CopyAssetsHandler } from '../../../../utils/assets/copy-assets-handler';
import { calculateProjectDependencies } from '../../../../utils/buildable-libs-utils';
import type { NormalizedExecutorOptions } from '../../../../utils/schema';
import { generateTempTsConfig } from './generate-temp-tsconfig';
import { getTaskOptions } from './get-task-options';
import type { TaskInfo } from './types';

const taskTsConfigCache = new Set<string>();

export function buildTaskInfoPerTsConfigMap(
  tsConfigTaskInfoMap: Record<string, TaskInfo>,
  tasksOptions: Record<string, NormalizedExecutorOptions>,
  context: ExecutorContext,
  tasks: string[],
  shouldWatch: boolean
): void {
  for (const taskName of tasks) {
    if (taskTsConfigCache.has(taskName)) {
      continue;
    }

    let taskOptions = tasksOptions[taskName];
    // task is in the batch (it's meant to be processed), create TaskInfo
    if (taskOptions) {
      const taskInfo = createTaskInfo(taskName, taskOptions, context);

      const tsConfigPath = generateTempTsConfig(
        tasksOptions,
        taskName,
        taskOptions,
        context
      );

      tsConfigTaskInfoMap[tsConfigPath] = taskInfo;
      taskTsConfigCache.add(taskName);
    } else {
      // if it's not included in the provided map, it could be a cached task and
      // we need to pull the options from the relevant project graph node
      taskOptions = getTaskOptions(taskName, context);
      generateTempTsConfig(tasksOptions, taskName, taskOptions, context);
    }

    buildTaskInfoPerTsConfigMap(
      tsConfigTaskInfoMap,
      tasksOptions,
      context,
      context.taskGraph.dependencies[taskName],
      shouldWatch
    );
  }
}

function createTaskInfo(
  taskName: string,
  taskOptions: NormalizedExecutorOptions,
  context: ExecutorContext
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
  };
}
