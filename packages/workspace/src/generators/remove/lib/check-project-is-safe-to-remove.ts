import {
  getProjects,
  logger,
  normalizePath,
  ProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { Schema } from '../schema';
import { relative } from 'path';

export function checkProjectIsSafeToRemove(
  tree: Tree,
  schema: Schema,
  project: ProjectConfiguration
) {
  if (project.root === '.') {
    throw new Error(
      `"${schema.projectName}" is the root project. Running this would delete every file in your workspace.`
    );
  }
  if (schema.forceRemove) {
    logger.warn(`You have passed --forceRemove`);
    return;
  }
  const containedProjects = [];
  for (const [_, p] of getProjects(tree)) {
    if (
      project.name !== p.name &&
      !normalizePath(relative(project.root, p.root)).startsWith('..')
    ) {
      containedProjects.push(p.name);
    }
  }
  if (containedProjects.length > 0) {
    throw new Error(
      `"${
        schema.projectName
      }" is a project that has nested projects within it. Removing this project would remove the following projects as well:\n - ${containedProjects.join(
        '\n - '
      )}\nPass --forceRemove to remove all of the above projects`
    );
  }
}
