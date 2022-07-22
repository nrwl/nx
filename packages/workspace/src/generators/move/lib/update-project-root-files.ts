import { ProjectConfiguration, Tree } from '@nrwl/devkit';
import { workspaceRoot } from '@nrwl/devkit';
import * as path from 'path';
import { extname, join } from 'path';
import { NormalizedSchema } from '../schema';
const allowedExt = ['.ts', '.js', '.json'];
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
      path.join(workspaceRoot, schema.relativeToRootDestination),
      workspaceRoot
    )
    .split(path.sep)
    .join('/');
  const oldRelativeRoot = path
    .relative(path.join(workspaceRoot, project.root), workspaceRoot)
    .split(path.sep)
    .join('/');

  if (newRelativeRoot === oldRelativeRoot) {
    // nothing to do
    return;
  }

  const dots = /\./g;
  const regex = new RegExp(
    `(?<!\\.\\.\\/)${oldRelativeRoot.replace(dots, '\\.')}(?!\\/\\.\\.)`,
    'g'
  );
  for (const file of tree.children(schema.relativeToRootDestination)) {
    const ext = extname(file);
    if (!allowedExt.includes(ext)) {
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
