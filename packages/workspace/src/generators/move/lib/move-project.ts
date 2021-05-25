import { ProjectConfiguration, Tree, visitNotIgnoredFiles } from '@nrwl/devkit';
import { Schema } from '../schema';
import { getDestination } from './utils';
import { join, relative } from 'path';

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
    const relativeFromOriginalSource = relative(project.root, file);
    const newFilePath = join(destination, relativeFromOriginalSource);
    tree.rename(file, newFilePath);
  });
}
