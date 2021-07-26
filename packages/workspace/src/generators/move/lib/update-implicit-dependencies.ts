import type { NxJsonConfiguration, Tree } from '@nrwl/devkit';
import { updateJson } from '@nrwl/devkit';
import type { NormalizedSchema } from '../schema';

/**
 * Updates the nx.json file by renaming the project
 *
 * @param schema The options provided to the schematic
 */
export function updateImplicitDependencies(
  tree: Tree,
  schema: NormalizedSchema
) {
  updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
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
