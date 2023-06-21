import type {
  ExecutorContext,
  ProjectGraphProjectNode,
  Target,
} from '@nx/devkit';
import { getOutputsForTargetAndConfiguration } from '@nx/devkit';
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

  const { taskOptions, root, projectNode, target } = parseTaskInfo(
    taskName,
    context
  );

  const outputs = getOutputsForTargetAndConfiguration(
    { overrides: context.taskGraph.tasks[taskName].overrides, target },
    projectNode
  );

  const outputPath = outputs.length
    ? join(context.root, outputs[0])
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
): {
  taskOptions: T;
  root: string;
  sourceRoot: string;
  projectNode: ProjectGraphProjectNode;
  target: Target;
} {
  const target = context.taskGraph.tasks[taskName].target;
  const projectNode = context.projectGraph.nodes[target.project];
  const targetConfig = projectNode.data.targets?.[target.target];
  const { sourceRoot, root } = projectNode.data;

  const taskOptions = {
    ...targetConfig.options,
    ...(target.configuration
      ? targetConfig.configurations?.[target.configuration]
      : {}),
  };

  return { taskOptions, root, sourceRoot, projectNode, target };
}
