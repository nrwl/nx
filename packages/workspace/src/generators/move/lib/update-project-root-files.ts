import * as path from 'path';
import { ProjectConfiguration, Tree } from '@nrwl/devkit';

import { appRootPath } from '../../../utilities/app-root';
import { Schema } from '../schema';
import { getDestination } from './utils';

/**
 * Updates the files in the root of the project
 *
 * Typically these are config files which point outside of the project folder
 *
 * @param schema The options provided to the schematic
 */
export function updateProjectRootFiles(
  tree: Tree,
  schema: Schema,
  project: ProjectConfiguration
) {
  const destination = getDestination(tree, schema, project);

  const newRelativeRoot = path
    .relative(path.join(appRootPath, destination), appRootPath)
    .split(path.sep)
    .join('/');
  const oldRelativeRoot = path
    .relative(path.join(appRootPath, project.root), appRootPath)
    .split(path.sep)
    .join('/');

  if (newRelativeRoot === oldRelativeRoot) {
    // nothing to do
    return;
  }

  const dots = /\./g;
  const regex = new RegExp(oldRelativeRoot.replace(dots, '\\.'), 'g');

  for (const file of tree.children(destination)) {
    if (!path.extname(file).startsWith('.js')) {
      continue;
    }

    const oldContent = tree.read(path.join(destination, file)).toString();
    const newContent = oldContent.replace(regex, newRelativeRoot);
    tree.write(path.join(destination, file), newContent);
  }
}
