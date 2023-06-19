import type { ExecutorContext } from '@nx/devkit';
import { parseTargetString } from '@nx/devkit';
import { join } from 'path';
import type {
  ExecutorOptions,
  NormalizedExecutorOptions,
} from '../../../utils/schema';
import { normalizeOptions } from './normalize-options';

export function getTaskOptions(
  taskName: string,
  context: ExecutorContext
):
  | NormalizedExecutorOptions
  | {
      tsConfig: string | null;
      rootDir: string;
      outputPath: string;
    } {
  const result = getTaskWithTscExecutorOptions(taskName, context);
  if (result) {
    return result;
  }

  const { taskOptions, root } = parseTaskInfo(taskName, context);

  const outputPath = taskOptions.outputPath
    ? join(context.root, taskOptions.outputPath)
    : join(context.root, 'dist', root);
  const rootDir = join(context.root, root);
  const tsConfig = taskOptions.tsConfig
    ? join(context.root, taskOptions.tsConfig)
    : null;

  return { tsConfig, rootDir, outputPath };
}

const tasksOptionsCache = new Map<string, NormalizedExecutorOptions>();
export function getTaskWithTscExecutorOptions(
  taskName: string,
  context: ExecutorContext
): NormalizedExecutorOptions | null {
  if (tasksOptionsCache.has(taskName)) {
    return tasksOptionsCache.get(taskName);
  }

  try {
    const { taskOptions, sourceRoot, root } = parseTaskInfo<ExecutorOptions>(
      taskName,
      context
    );

    const normalizedTaskOptions = normalizeOptions(
      taskOptions,
      context.root,
      sourceRoot,
      root
    );

    tasksOptionsCache.set(taskName, normalizedTaskOptions);

    return normalizedTaskOptions;
  } catch {
    tasksOptionsCache.set(taskName, null);
    return null;
  }
}

function parseTaskInfo<T = Record<string, any>>(
  taskName: string,
  context: ExecutorContext
): { taskOptions: T; root: string; sourceRoot: string } {
  const target = context.taskGraph.tasks[taskName].target;
  const projectNode = context.projectGraph.nodes[target.project];
  const targetConfig = projectNode.data.targets?.[target.target];

  const taskOptions = {
    ...targetConfig.options,
    ...(target.configuration
      ? targetConfig.configurations?.[target.configuration]
      : {}),
  };

  const { project } = parseTargetString(taskName, context.projectGraph);
  const { sourceRoot, root } = context.projectsConfigurations.projects[project];

  return { taskOptions, root, sourceRoot };
}
