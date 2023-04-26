import { Schema } from '../schema';
import {
  getProjects,
  readNxJson,
  removeProjectConfiguration,
  Tree,
  updateNxJson,
  updateProjectConfiguration,
} from '@nx/devkit';

export function removeProjectReferencesInConfig(tree: Tree, schema: Schema) {
  // Unset default project if deleting the default project
  const nxJson = readNxJson(tree);
  if (nxJson.defaultProject && nxJson.defaultProject === schema.projectName) {
    delete nxJson.defaultProject;
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
