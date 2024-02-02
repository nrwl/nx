import type { Target } from 'nx/src/command-line/run/run';
import type { ExecutorContext } from 'nx/src/config/misc-interfaces';
import { requireNx } from '../../nx';
import { relative } from 'path';

let {
  Workspaces,
  getExecutorInformation,
  calculateDefaultProjectName,
  combineOptionsForExecutor,
} = requireNx();

// TODO: Remove this in Nx 19 when Nx 16.7.0 is no longer supported
combineOptionsForExecutor =
  combineOptionsForExecutor ??
  require('nx/src/utils/params').combineOptionsForExecutor;

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

  if (!projectConfiguration) {
    throw new Error(`Unable to find project ${project}`);
  }

  const targetConfiguration = projectConfiguration.targets[target];

  if (!targetConfiguration) {
    throw new Error(`Unable to find target ${target} for project ${project}`);
  }

  // TODO(v19): remove Workspaces.
  const ws = new Workspaces(context.root);
  const [nodeModule, executorName] = targetConfiguration.executor.split(':');
  const { schema } = getExecutorInformation
    ? getExecutorInformation(
        nodeModule,
        executorName,
        context.root,
        context.projectsConfigurations?.projects ?? context.workspace.projects
      )
    : // TODO(v19): remove readExecutor. This is to be backwards compatible with Nx 16.5 and below.
      (ws as any).readExecutor(nodeModule, executorName);

  const defaultProject = calculateDefaultProjectName
    ? calculateDefaultProjectName(
        context.cwd,
        context.root,
        { version: 2, projects: context.projectsConfigurations.projects },
        context.nxJsonConfiguration
      )
    : // TODO(v19): remove calculateDefaultProjectName. This is to be backwards compatible with Nx 16.5 and below.
      (ws as any).calculateDefaultProjectName(
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
    relative(context.root, context.cwd)
  ) as T;
}
