import { join } from 'path';
import { ProjectConfiguration, Tree } from '@nrwl/devkit';

import { Schema } from '../schema';
import { getDestination, getNewProjectName } from './utils';

/**
 * Update the README.md file of the project if it exists.
 *
 * @param schema The options provided to the schematic
 */
export function updateReadme(
  tree: Tree,
  schema: Schema,
  project: ProjectConfiguration
) {
  const destination = getDestination(tree, schema, project);
  const readmePath = join(destination, 'README.md');

  if (!tree.exists(readmePath)) {
    // no README found. nothing to do
    return;
  }
  const newProjectName = getNewProjectName(schema.destination);
  const findName = new RegExp(`${schema.projectName}`, 'g');
  const oldContent = tree.read(readmePath, 'utf-8');
  const newContent = oldContent.replace(findName, newProjectName);
  tree.write(readmePath, newContent);
}
