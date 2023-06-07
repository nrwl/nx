import type { ExecutorContext } from '@nx/devkit';
import { parseTargetString } from '@nx/devkit';
import type {
  ExecutorOptions,
  NormalizedExecutorOptions,
} from '../../../../utils/schema';
import { normalizeOptions } from '../normalize-options';

const tasksOptionsCache = new Map<string, NormalizedExecutorOptions>();

export function getTaskOptions(
  taskName: string,
  context: ExecutorContext
): NormalizedExecutorOptions {
  if (tasksOptionsCache.has(taskName)) {
    return tasksOptionsCache.get(taskName);
  }

  const target = context.taskGraph.tasks[taskName].target;
  const projectNode = context.projectGraph.nodes[target.project];
  const targetConfig = projectNode.data.targets?.[target.target];

  const taskOptions: ExecutorOptions = {
    ...targetConfig.options,
    ...(target.configuration
      ? targetConfig.configurations?.[target.configuration]
      : {}),
  };

  const { project } = parseTargetString(taskName, context.projectGraph);
  const { sourceRoot, root } = context.projectsConfigurations.projects[project];

  const normalizedTaskOptions = normalizeOptions(
    taskOptions,
    context.root,
    sourceRoot,
    root
  );

  tasksOptionsCache.set(taskName, normalizedTaskOptions);

  return normalizedTaskOptions;
}
