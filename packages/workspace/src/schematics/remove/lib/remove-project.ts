import { SchematicContext, Tree } from '@angular-devkit/schematics';
import { getWorkspace } from '@nrwl/workspace';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Schema } from '../schema';

/**
 * Removes (deletes) a project from the folder tree
 *
 * @param schema The options provided to the schematic
 */
export function removeProject(schema: Schema) {
  return (tree: Tree, _context: SchematicContext): Observable<Tree> => {
    return from(getWorkspace(tree)).pipe(
      map((workspace) => {
        const project = workspace.projects.get(schema.projectName);
        tree.delete(project.root);
        return tree;
      })
    );
  };
}
