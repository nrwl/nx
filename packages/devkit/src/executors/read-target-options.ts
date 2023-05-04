import type { Target } from 'nx/src/command-line/run/run';
import type { ExecutorContext } from 'nx/src/config/misc-interfaces';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { combineOptionsForExecutor } from 'nx/src/utils/params';
import { requireNx } from '../../nx';

const { Workspaces } = requireNx();

/**
 * Reads and combines options for a given target.
 *
 * Works as if you invoked the target yourself without passing any command lint overrides.
 */
export function readTargetOptions<T = any>(
  { project, target, configuration }: Target,
  context: ExecutorContext
): T {
  const projectConfiguration = (
    context.workspace || context.projectsConfigurations
  ).projects[project];
  const targetConfiguration = projectConfiguration.targets[target];

  const ws = new Workspaces(context.root);
  const [nodeModule, executorName] = targetConfiguration.executor.split(':');
  const { schema } = ws.readExecutor(nodeModule, executorName);

  const defaultProject = ws.calculateDefaultProjectName(
    context.cwd,
    { version: 2, projects: context.projectsConfigurations.projects },
    context.nxJsonConfiguration
  );

  return combineOptionsForExecutor(
    {},
    configuration ?? targetConfiguration.defaultConfiguration ?? '',
    targetConfiguration,
    schema,
    defaultProject,
    ws.relativeCwd(context.cwd)
  ) as T;
}
