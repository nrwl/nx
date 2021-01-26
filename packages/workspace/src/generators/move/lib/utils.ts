import {
  getWorkspaceLayout,
  joinPathFragments,
  ProjectConfiguration,
  Tree,
} from '@nrwl/devkit';

import { Schema } from '../schema';

/**
 * This helper function ensures that we don't move libs or apps
 * outside of the folders they should be in.
 *
 * This will break if someone isn't using the default libs/apps
 * folders. In that case, they're on their own :/
 */
export function getDestination(
  host: Tree,
  schema: Schema,
  project: ProjectConfiguration
): string {
  const projectType = project.projectType;

  const workspaceLayout = getWorkspaceLayout(host);

  let rootFolder = workspaceLayout.libsDir;
  if (projectType === 'application') {
    rootFolder = workspaceLayout.appsDir;
  }
  return joinPathFragments(rootFolder, schema.destination);
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
    .filter((x) => !!x)
    .join('/');
}
