import type { Target } from '@nrwl/tao/src/commands/run';
import type { ExecutorContext } from '@nrwl/tao/src/shared/workspace';
import { Workspaces } from '@nrwl/tao/src/shared/workspace';
import { combineOptionsForExecutor } from '@nrwl/tao/src/shared/params';

/**
 * Reads and combines options for a given target.
 *
 * Works as if you invoked the target yourself without passing any command lint overrides.
 */
export function readTargetOptions<T = any>(
  { project, target, configuration }: Target,
  context: ExecutorContext
): T {
  const projectConfiguration = context.workspace.projects[project];
  const targetConfiguration = projectConfiguration.targets[target];

  const ws = new Workspaces(context.root);
  const [nodeModule, executorName] = targetConfiguration.executor.split(':');
  const { schema } = ws.readExecutor(nodeModule, executorName);

  const defaultProject = ws.calculateDefaultProjectName(
    context.cwd,
    context.workspace
  );

  return combineOptionsForExecutor(
    {},
    configuration ?? '',
    targetConfiguration,
    schema,
    defaultProject,
    ws.relativeCwd(context.cwd)
  ) as T;
}
