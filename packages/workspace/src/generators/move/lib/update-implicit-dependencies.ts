import type { Tree } from '@nx/devkit';
import { getProjects, updateProjectConfiguration } from '@nx/devkit';
import type { NormalizedSchema } from '../schema';

/**
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
