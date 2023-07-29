import type {
  ExecutorContext,
  ProjectGraphProjectNode,
  Target,
} from '@nx/devkit';
import type {
  ExecutorOptions,
  NormalizedExecutorOptions,
} from '../../../utils/schema';
import { normalizeOptions } from './normalize-options';

const tasksOptionsCache = new Map<string, NormalizedExecutorOptions>();
export function getTaskOptions(
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
