import { JsonObject } from '@angular-devkit/core';
import { Rule } from '@angular-devkit/schematics';
import { updateWorkspace } from '../workspace';

/**
 * Sets the default collection to the provided collection name
 * The collection name is only set in case the current defaultCollection is undefined or set to '@nrwl/workspace'
 * @param collectionName Name of the collection to be set as defaultCollection
 */
export function setDefaultCollection(collectionName: string): Rule {
  return updateWorkspace((workspace) => {
    workspace.extensions.cli = workspace.extensions.cli || {};

    const defaultCollection: string =
      workspace.extensions.cli &&
      ((workspace.extensions.cli as JsonObject).defaultCollection as string);

    if (!defaultCollection || defaultCollection === '@nrwl/workspace') {
      (workspace.extensions.cli as JsonObject).defaultCollection =
        collectionName;
    }
  });
}
