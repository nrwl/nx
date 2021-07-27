import { Tree } from '@nrwl/devkit';
import { join } from 'path';
import { NormalizedSchema } from '../schema';

/**
 * Update the README.md file of the project if it exists.
 *
 * @param schema The options provided to the schematic
 */
export function updateReadme(tree: Tree, schema: NormalizedSchema) {
  const readmePath = join(schema.relativeToRootDestination, 'README.md');

  if (!tree.exists(readmePath)) {
    // no README found. nothing to do
    return;
  }
  const findName = new RegExp(`${schema.projectName}`, 'g');
  const oldContent = tree.read(readmePath, 'utf-8');
  const newContent = oldContent.replace(findName, schema.newProjectName);
  tree.write(readmePath, newContent);
}
