import type {
  ExecutorContext,
  ProjectGraphProjectNode,
  Target,
  TaskGraph,
} from '@nx/devkit';
import type {
  ExecutorOptions,
  NormalizedExecutorOptions,
} from '../../../utils/schema';
import { normalizeOptions } from './normalize-options';

export function getTaskGraph(context: ExecutorContext): TaskGraph {
  if (!context.taskGraph) {
    throw new Error('The task graph is not available in the executor context.');
  }
  return context.taskGraph;
}

const tasksOptionsCache = new Map<string, NormalizedExecutorOptions | null>();
export function getTaskOptions(
  taskName: string,
  context: ExecutorContext
): NormalizedExecutorOptions | null {
  const cachedOptions = tasksOptionsCache.get(taskName);
  if (cachedOptions !== undefined) {
    return cachedOptions;
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
  sourceRoot: string | undefined;
  projectNode: ProjectGraphProjectNode;
  target: Target;
} {
  const target = getTaskGraph(context).tasks[taskName].target;
  const projectNode = context.projectGraph.nodes[target.project];
  const targetConfig = projectNode.data.targets?.[target.target];
  if (!targetConfig) {
    throw new Error(`Cannot find target configuration for task ${taskName}.`);
  }
  const { sourceRoot, root } = projectNode.data;

  const taskOptions = {
    ...targetConfig.options,
    ...(target.configuration
      ? targetConfig.configurations?.[target.configuration]
      : {}),
  };

  return { taskOptions, root, sourceRoot, projectNode, target };
}
