import { readNxJson, Tree, updateNxJson } from '@nx/devkit';
import { NormalizedSchema } from '../schema';

/**
 * Updates the project in the workspace file
 *
 * - update all references to the old root path
 * - change the project name
 * - change target references
 */
export function updateDefaultProject(tree: Tree, schema: NormalizedSchema) {
  const nxJson = readNxJson(tree);

  // update default project (if necessary)
  if (nxJson.defaultProject && nxJson.defaultProject === schema.projectName) {
    nxJson.defaultProject = schema.newProjectName;
    updateNxJson(tree, nxJson);
  }
}
