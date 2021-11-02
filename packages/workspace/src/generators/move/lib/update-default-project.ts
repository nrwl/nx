import {
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { NormalizedSchema } from '../schema';

/**
 * Updates the project in the workspace file
 *
 * - update all references to the old root path
 * - change the project name
 * - change target references
 */
export function updateDefaultProject(tree: Tree, schema: NormalizedSchema) {
  const workspaceConfiguration = readWorkspaceConfiguration(tree);

  // update default project (if necessary)
  if (
    workspaceConfiguration.defaultProject &&
    workspaceConfiguration.defaultProject === schema.projectName
  ) {
    workspaceConfiguration.defaultProject = schema.newProjectName;
    updateWorkspaceConfiguration(tree, workspaceConfiguration);
  }
}
