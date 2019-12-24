import { WorkspaceDefinition } from '@angular-devkit/core/src/workspace';
import * as path from 'path';
import { Schema } from '../schema';

/**
 * This helper function ensures that we don't move libs or apps
 * outside of the folders they should be in.
 *
 * This will break if someone isn't using the default libs/apps
 * folders. In that case, they're on their own :/
 *
 * @param schema
 * @param workspace
 */
export function getDestination(
  schema: Schema,
  workspace: WorkspaceDefinition | any
): string {
  const project = workspace.projects.get
    ? workspace.projects.get(schema.projectName)
    : workspace.projects[schema.projectName];
  const projectType = project.extensions
    ? project.extensions['projectType']
    : project.projectType;

  let rootFolder = 'libs';
  if (projectType === 'application') {
    rootFolder = 'apps';
  }
  return path.join(rootFolder, schema.destination);
}

/**
 * Replaces slashes with dashes
 *
 * @param path
 */
export function getNewProjectName(path: string): string {
  return path.replace(/\//g, '-');
}

/**
 * Normalizes slashes (removes duplicates)
 *
 * @param input
 */
export function normalizeSlashes(input: string): string {
  return input
    .split('/')
    .filter(x => !!x)
    .join('/');
}
