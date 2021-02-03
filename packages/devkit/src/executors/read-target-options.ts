import { Target } from '@nrwl/tao/src/commands/run';
import { ExecutorContext, Workspaces } from '@nrwl/tao/src/shared/workspace';
import { combineOptionsForExecutor } from '@nrwl/tao/src/shared/params';

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
    configuration,
    targetConfiguration,
    schema,
    defaultProject,
    ws.relativeCwd(context.cwd)
  ) as T;
}
