import { ProjectConfiguration, Tree } from '@nrwl/devkit';
import { appRootPath } from 'nx/src/utils/app-root';
import * as path from 'path';
import { extname, join } from 'path';
import { NormalizedSchema } from '../schema';

/**
 * Updates the files in the root of the project
 *
 * Typically these are config files which point outside of the project folder
 *
 * @param schema The options provided to the schematic
 */
export function updateProjectRootFiles(
  tree: Tree,
  schema: NormalizedSchema,
  project: ProjectConfiguration
) {
  const newRelativeRoot = path
    .relative(
      path.join(appRootPath, schema.relativeToRootDestination),
      appRootPath
    )
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

  for (const file of tree.children(schema.relativeToRootDestination)) {
    if (!extname(file).startsWith('.js')) {
      continue;
    }
    if (file === '.eslintrc.json') {
      continue;
    }

    const oldContent = tree.read(
      join(schema.relativeToRootDestination, file),
      'utf-8'
    );
    const newContent = oldContent.replace(regex, newRelativeRoot);
    tree.write(join(schema.relativeToRootDestination, file), newContent);
  }
}
