import { SchematicContext, Tree } from '@angular-devkit/schematics';
import { getWorkspace } from '@nrwl/workspace';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Schema } from '../schema';
import { getDestination } from './utils';

/**
 * Moves a project to the given destination path
 *
 * @param schema The options provided to the schematic
 */
export function moveProject(schema: Schema) {
  return (tree: Tree, _context: SchematicContext): Observable<Tree> => {
    return from(getWorkspace(tree)).pipe(
      map((workspace) => {
        const project = workspace.projects.get(schema.projectName);

        const destination = getDestination(schema, workspace, tree);
        const dir = tree.getDir(project.root);
        dir.visit((file) => {
          const newPath = file.replace(project.root, destination);
          tree.create(newPath, tree.read(file));
        });

        tree.delete(project.root);

        return tree;
      })
    );
  };
}
