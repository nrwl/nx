import type { ExecutorContext } from '@nx/devkit';
import { parseTargetString } from '@nx/devkit';
import type {
  ExecutorOptions,
  NormalizedExecutorOptions,
} from '../../../../utils/schema';
import { normalizeOptions } from '../normalize-options';

export function normalizeTasksOptions(
  inputs: Record<string, ExecutorOptions>,
  context: ExecutorContext
): Record<string, NormalizedExecutorOptions> {
  return Object.entries(inputs).reduce((tasksOptions, [taskName, options]) => {
    const { project } = parseTargetString(taskName, context.projectGraph);
    const { sourceRoot, root } =
      context.projectsConfigurations.projects[project];
    tasksOptions[taskName] = normalizeOptions(
      options,
      context.root,
      sourceRoot,
      root
    );
    return tasksOptions;
  }, {} as Record<string, NormalizedExecutorOptions>);
}
