import {
  Tree,
  readWorkspaceConfiguration,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';

/**
 * Sets the default collection within the workspace.
 *
 * Will only set the defaultCollection if one does not exist or if it is not `@nrwl/workspace`
 *
 * @deprecated NxJson defaultCollection will be removed
 * @param host
 * @param collectionName Name of the collection to be set as the default
 */
export function setDefaultCollection(host: Tree, collectionName: string) {
  const workspace = readWorkspaceConfiguration(host);
  workspace.cli = workspace.cli || {};

  const defaultCollection = workspace.cli.defaultCollection;

  if (!defaultCollection || defaultCollection === '@nrwl/workspace') {
    workspace.cli.defaultCollection = collectionName;
  }

  updateWorkspaceConfiguration(host, workspace);
}
