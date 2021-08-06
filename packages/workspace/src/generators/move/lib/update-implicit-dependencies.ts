import type { NxJsonConfiguration, Tree } from '@nrwl/devkit';
import { updateJson, updateWorkspaceJson } from '@nrwl/devkit';
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
  updateWorkspaceJson(tree, (json) => {
    Object.values(json.projects).forEach((project) => {
      if (project.implicitDependencies) {
        const index = project.implicitDependencies.indexOf(schema.projectName);
        if (index !== -1) {
          project.implicitDependencies[index] = schema.newProjectName;
        }
      }
    });
    return json;
  });
}
