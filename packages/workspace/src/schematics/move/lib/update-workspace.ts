import { SchematicContext, Tree } from '@angular-devkit/schematics';
import { updateWorkspaceInTree } from '@nrwl/workspace';
import { Schema } from '../schema';
import { getDestination, getNewProjectName } from './utils';

/**
 * Updates the project in the workspace file
 *
 * - update all references to the old root path
 * - change the project name
 * - change target references
 *
 * @param schema The options provided to the schematic
 */
export function updateWorkspace(schema: Schema) {
  return (tree: Tree, _context: SchematicContext) => {
    return updateWorkspaceInTree((workspace) => {
      const project = workspace.projects[schema.projectName];
      const newProjectName = getNewProjectName(schema.destination);

      // update root path refs in that project only
      const oldProject = JSON.stringify(project);
      const newProject = oldProject.replace(
        new RegExp(project.root, 'g'),
        getDestination(schema, workspace, tree)
      );

      // rename
      delete workspace.projects[schema.projectName];
      workspace.projects[newProjectName] = JSON.parse(newProject);

      // update target refs
      const strWorkspace = JSON.stringify(workspace);
      workspace = JSON.parse(
        strWorkspace.replace(
          new RegExp(`${schema.projectName}:`, 'g'),
          `${newProjectName}:`
        )
      );

      // update default project (if necessary)
      if (
        workspace.defaultProject &&
        workspace.defaultProject === schema.projectName
      ) {
        workspace.defaultProject = newProjectName;
      }

      return workspace;
    });
  };
}
