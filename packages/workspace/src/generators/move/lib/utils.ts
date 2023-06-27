import {
  getWorkspaceLayout,
  joinPathFragments,
  normalizePath,
  ProjectConfiguration,
  Tree,
} from '@nx/devkit';
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
  if (schema.destinationRelativeToRoot) {
    return schema.destination;
  }

  const projectType = project.projectType;

  const workspaceLayout = getWorkspaceLayout(host);

  let rootFolder = workspaceLayout.libsDir;
  if (projectType === 'application') {
    rootFolder = workspaceLayout.appsDir;
  }
  return joinPathFragments(rootFolder, schema.destination);
}

/**
 * Joins path segments replacing slashes with dashes
 *
 * @param path
 */
export function getNewProjectName(path: string): string {
  // strip leading '/' or './' or '../' and trailing '/' and replaces '/' with '-'
  return normalizePath(path)
    .replace(/(^\.{0,2}\/|\.{1,2}\/|\/$)/g, '')
    .split('/')
    .filter((x) => !!x)
    .join('-');
}

/**
 * Normalizes slashes (removes duplicates)
 *
 * @param input
 */
export function normalizePathSlashes(input: string): string {
  return (
    normalizePath(input)
      // strip leading ./ or /
      .replace(/^\.?\//, '')
      .split('/')
      .filter((x) => !!x)
      .join('/')
  );
}
