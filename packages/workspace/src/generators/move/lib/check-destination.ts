import { ProjectConfiguration, Tree } from '@nrwl/devkit';
import { Schema } from '../schema';
import { getDestination } from './utils';

/**
 * Checks whether the destination folder is valid
 *
 * - must not be outside the workspace
 * - must be a new folder
 *
 * @param schema The options provided to the schematic
 */
export function checkDestination(
  tree: Tree,
  schema: Schema,
  projectConfig: ProjectConfiguration
) {
  const INVALID_DESTINATION = `Invalid destination: [${schema.destination}]`;

  if (schema.destination.includes('..')) {
    throw new Error(`${INVALID_DESTINATION} - Please specify explicit path.`);
  }

  const destination = getDestination(tree, schema, projectConfig);

  if (tree.children(destination).length > 0) {
    throw new Error(`${INVALID_DESTINATION} - Path is not empty.`);
  }
}
