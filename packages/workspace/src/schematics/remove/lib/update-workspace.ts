import { updateWorkspaceInTree } from '@nrwl/workspace';
import { Schema } from '../schema';

/**
 * Deletes the project from the workspace file
 *
 * @param schema The options provided to the schematic
 */
export function updateWorkspace(schema: Schema) {
  return updateWorkspaceInTree((workspace) => {
    delete workspace.projects[schema.projectName];
    return workspace;
  });
}
