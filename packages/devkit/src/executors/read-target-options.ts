import { relative } from 'path';

import type { ExecutorContext, Target } from 'nx/src/devkit-exports';

import {
  calculateDefaultProjectName,
  combineOptionsForExecutor,
  getExecutorInformation,
} from 'nx/src/devkit-internals';

/**
 * Reads and combines options for a given target.
 *
 * Works as if you invoked the target yourself without passing any command lint overrides.
 */
export function readTargetOptions<T = any>(
  { project, target, configuration }: Target,
  context: ExecutorContext
): T {
  const projectConfiguration = context.projectsConfigurations.projects[project];

  if (!projectConfiguration) {
    throw new Error(`Unable to find project ${project}`);
  }

  const targetConfiguration = projectConfiguration.targets[target];

  if (!targetConfiguration) {
    throw new Error(`Unable to find target ${target} for project ${project}`);
  }

  const [nodeModule, executorName] = targetConfiguration.executor.split(':');
  const { schema } = getExecutorInformation(
    nodeModule,
    executorName,
    context.root,
    context.projectsConfigurations?.projects
  );

  const defaultProject = calculateDefaultProjectName(
    context.cwd,
    context.root,
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
