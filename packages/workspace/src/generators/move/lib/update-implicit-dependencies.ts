import type { Tree } from '@nrwl/devkit';
import { updateWorkspace, readWorkspace } from '@nrwl/devkit';
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
  const workspaceJson = readWorkspace(tree);
  Object.values(workspaceJson.projects).forEach((project) => {
    if (project.implicitDependencies) {
      const index = project.implicitDependencies.indexOf(schema.projectName);
      if (index !== -1) {
        project.implicitDependencies[index] = schema.newProjectName;
      }
    }
  });
  updateWorkspace(tree, workspaceJson);
}
