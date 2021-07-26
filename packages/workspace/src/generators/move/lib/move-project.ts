import { ProjectConfiguration, Tree, visitNotIgnoredFiles } from '@nrwl/devkit';
import { join, relative } from 'path';
import { NormalizedSchema } from '../schema';

/**
 * Moves a project to the given destination path
 *
 * @param schema The options provided to the schematic
 */
export function moveProject(
  tree: Tree,
  schema: NormalizedSchema,
  project: ProjectConfiguration
) {
  visitNotIgnoredFiles(tree, project.root, (file) => {
    // This is a rename but Angular Devkit isn't capable of writing to a file after it's renamed so this is a workaround
    const content = tree.read(file);
    const relativeFromOriginalSource = relative(project.root, file);
    const newFilePath = join(
      schema.relativeToRootDestination,
      relativeFromOriginalSource
    );
    tree.write(newFilePath, content);
    tree.delete(file);
  });
}
