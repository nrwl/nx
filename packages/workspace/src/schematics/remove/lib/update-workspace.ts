import { Schema } from '../schema';
import { SchematicContext, Tree } from '@angular-devkit/schematics';
import { updateWorkspaceInTree, getWorkspacePath } from '@nrwl/workspace';

/**
 * Deletes the project from the workspace file
 *
 * @param schema The options provided to the schematic
 */
export function updateWorkspace(schema: Schema) {
  return updateWorkspaceInTree(
    (workspace, context: SchematicContext, host: Tree) => {
      delete workspace.projects[schema.projectName];
      if (
        workspace.defaultProject &&
        workspace.defaultProject === schema.projectName
      ) {
        delete workspace.defaultProject;
        const workspacePath = getWorkspacePath(host);
        context.logger.warn(
          `Default project was removed in ${workspacePath} because it was "${schema.projectName}". If you want a default project you should define a new one.`
        );
      }
      return workspace;
    }
  );
}
