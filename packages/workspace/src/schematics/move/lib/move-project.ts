import { SchematicContext } from '@angular-devkit/schematics';
import { ProjectConfiguration, Tree, visitNotIgnoredFiles } from '@nrwl/devkit';
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
export function moveProject(
  tree: Tree,
  schema: Schema,
  project: ProjectConfiguration
) {
  const destination = getDestination(tree, schema, project);
  visitNotIgnoredFiles(tree, project.root, (file) => {
    // This is a rename but Angular Devkit isn't capable of writing to a file after it's renamed so this is a workaround
    const content = tree.read(file);
    tree.write(file.replace(project.root, destination), content);
    tree.delete(file);
  });

  tree.delete(project.root);
}
