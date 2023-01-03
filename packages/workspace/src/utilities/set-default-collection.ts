import { readNxJson, Tree, updateNxJson } from '@nrwl/devkit';

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
  const nxJson = readNxJson(host);
  nxJson.cli = nxJson.cli || {};

  const defaultCollection = nxJson.cli.defaultCollection;

  if (!defaultCollection || defaultCollection === '@nrwl/workspace') {
    nxJson.cli.defaultCollection = collectionName;
  }

  updateNxJson(host, nxJson);
}
