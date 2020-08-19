import { WorkspaceDefinition } from '@angular-devkit/core/src/workspace';
import { Tree } from '@angular-devkit/schematics';
import { NxJson } from '@nrwl/workspace/src/core/shared-interfaces';
import { readJsonInTree } from '@nrwl/workspace/src/utils/ast-utils';
import * as path from 'path';
import { Schema } from '../schema';

/**
 * This helper function retrieves the users workspace layout from
 * `nx.json`. If the user does not have this property defined then
 * we assume the default `apps/` and `libs/` layout.
 *
 * @param host The host tree
 */
export function getWorkspaceLayout(
  host: Tree
): { appsDir?: string; libsDir?: string } {
  const nxJson = readJsonInTree<NxJson>(host, 'nx.json');
  const workspaceLayout = nxJson.workspaceLayout
    ? nxJson.workspaceLayout
    : { appsDir: 'apps', libsDir: 'libs' };

  return workspaceLayout;
}

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
  workspace: WorkspaceDefinition | any,
  host: Tree
): string {
  const project = workspace.projects.get
    ? workspace.projects.get(schema.projectName)
    : workspace.projects[schema.projectName];
  const projectType = project.extensions
    ? project.extensions['projectType']
    : project.projectType;

  const workspaceLayout = getWorkspaceLayout(host);

  let rootFolder = workspaceLayout.libsDir;
  if (projectType === 'application') {
    rootFolder = workspaceLayout.appsDir;
  }
  return path.join(rootFolder, schema.destination).split(path.sep).join('/');
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
