import type { Tree } from '@nx/devkit';
import type { NormalizedSchema } from '../schema';

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
  schema: NormalizedSchema,
  providedDestination: string
) {
  const INVALID_DESTINATION = `Invalid destination: [${providedDestination}]`;

  if (providedDestination.includes('..')) {
    throw new Error(`${INVALID_DESTINATION} - Please specify explicit path.`);
  }

  if (tree.children(schema.relativeToRootDestination).length > 0) {
    throw new Error(`${INVALID_DESTINATION} - Path is not empty.`);
  }
}
