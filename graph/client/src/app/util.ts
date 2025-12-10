/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { FileDataDependency } from 'nx/src/config/project-graph';
/* eslint-enable @nx/enforce-module-boundaries */

export function createTaskName(
  project: string,
  target: string,
  configuration?: string
) {
  if (configuration) {
    return `task-${project}:${target}:${configuration}`;
  } else {
    return `task-${project}:${target}`;
  }
}

export function extractDependencyTarget(dependency: FileDataDependency) {
  if (typeof dependency === 'string') return dependency;
  if (dependency.length === 2) return dependency[0];
  return dependency[1];
}
