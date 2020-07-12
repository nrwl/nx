import { Rule, SchematicContext } from '@angular-devkit/schematics';
import { Tree } from '@angular-devkit/schematics/src/tree/interface';
import { getWorkspace } from '@nrwl/workspace';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Schema } from '../schema';
import { getDestination, normalizeSlashes } from './utils';

/**
 * Checks whether the destination folder is valid
 *
 * - must not be outside the workspace
 * - must be a new folder
 *
 * @param schema The options provided to the schematic
 */
export function checkDestination(schema: Schema): Rule {
  return (tree: Tree, _context: SchematicContext): Observable<Tree> => {
    return from(getWorkspace(tree)).pipe(
      map((workspace) => {
        const INVALID_DESTINATION = `Invalid destination: [${schema.destination}]`;

        if (schema.destination.includes('..')) {
          throw new Error(
            `${INVALID_DESTINATION} - Please specify explicit path.`
          );
        }

        const destination = getDestination(schema, workspace, tree);

        if (tree.getDir(destination).subfiles.length > 0) {
          throw new Error(`${INVALID_DESTINATION} - Path is not empty.`);
        }

        if (schema.destination.startsWith('/')) {
          schema.destination = normalizeSlashes(schema.destination.substr(1));
        }

        return tree;
      })
    );
  };
}
