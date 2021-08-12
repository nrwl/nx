import { JsonObject } from '@angular-devkit/core';
import { Rule } from '@angular-devkit/schematics';
import { updateJsonInTree } from '../ast-utils';

/**
 * Sets the default collection to the provided collection name
 * The collection name is only set in case the current defaultCollection is undefined or set to '@nrwl/workspace'
 * @param collectionName Name of the collection to be set as defaultCollection
 */
export function setDefaultCollection(collectionName: string): Rule {
  return updateJsonInTree('nx.json', (workspace) => {
    workspace.cli = workspace.cli || {};

    const defaultCollection: string =
      workspace.cli &&
      ((workspace.cli as JsonObject).defaultCollection as string);

    if (!defaultCollection || defaultCollection === '@nrwl/workspace') {
      (workspace.cli as JsonObject).defaultCollection =
        collectionName;
    }
    
    return workspace;
  });
}
