import { Rule, SchematicContext, Tree } from '@angular-devkit/schematics';
import { getWorkspace } from '@nrwl/workspace';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Schema } from '../schema';

/**
 * Checks whether the project exists in the workspace.
 *
 * @param schema The options provided to the schematic
 */
export function checkProjectExists(schema: Schema): Rule {
  return (tree: Tree, _context: SchematicContext): Observable<Tree> => {
    return from(getWorkspace(tree)).pipe(
      map(workspace => {
        if (!workspace.projects.has(schema.projectName)) {
          throw new Error(
            `Project not found in workspace: [${schema.projectName}]`
          );
        }

        return tree;
      })
    );
  };
}
