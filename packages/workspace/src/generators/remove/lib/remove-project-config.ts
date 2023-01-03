import { Schema } from '../schema';
import {
  getProjects,
  getWorkspacePath,
  readNxJson,
  removeProjectConfiguration,
  Tree,
  updateNxJson,
  updateProjectConfiguration,
} from '@nrwl/devkit';

/**
 * Deletes the project from the workspace file
 *
 * @param schema The options provided to the schematic
 */
export function removeProjectConfig(tree: Tree, schema: Schema) {
  removeProjectConfiguration(tree, schema.projectName);

  // Unset default project if deleting the default project
  const nxJson = readNxJson(tree);
  if (nxJson.defaultProject && nxJson.defaultProject === schema.projectName) {
    const workspacePath = getWorkspacePath(tree);
    delete nxJson.defaultProject;
    console.warn(
      `Default project was removed in ${workspacePath} because it was "${schema.projectName}". If you want a default project you should define a new one.`
    );

    updateNxJson(tree, nxJson);
  }

  // Remove implicit dependencies onto removed project
  getProjects(tree).forEach((project, projectName) => {
    if (
      project.implicitDependencies &&
      project.implicitDependencies.some(
        (projectName) => projectName === schema.projectName
      )
    ) {
      project.implicitDependencies = project.implicitDependencies.filter(
        (projectName) => projectName !== schema.projectName
      );
      updateProjectConfiguration(tree, projectName, project);
    }
  });
}
