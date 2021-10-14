import type { Tree } from '@nrwl/devkit';
import { getProjects, updateProjectConfiguration } from '@nrwl/devkit';
import type { NormalizedSchema } from '../schema';

/**
 * Updates the workspace.json file by renaming the project
 *
 * @param schema The options provided to the schematic
 */
export function updateImplicitDependencies(
  tree: Tree,
  schema: NormalizedSchema
) {
  for (const [projectName, project] of getProjects(tree)) {
    if (project.implicitDependencies) {
      const index = project.implicitDependencies.indexOf(schema.projectName);
      if (index !== -1) {
        project.implicitDependencies[index] = schema.newProjectName;
        updateProjectConfiguration(tree, projectName, project);
      }
    }
  }
}
