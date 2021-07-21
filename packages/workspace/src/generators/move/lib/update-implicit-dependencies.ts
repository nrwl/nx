import { updateJson } from '@nrwl/devkit';
import type { Tree, NxJsonConfiguration } from '@nrwl/devkit';
import type { Schema } from '../schema';
import { getNewProjectName } from './utils';

/**
 * Updates the nx.json file by renaming the project
 *
 * @param schema The options provided to the schematic
 */
export function updateImplicitDependencies(tree: Tree, schema: Schema) {
  updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
    Object.values(json.projects).forEach((project) => {
      if (project.implicitDependencies) {
        const index = project.implicitDependencies.indexOf(schema.projectName);
        if (index !== -1) {
          project.implicitDependencies[index] = getNewProjectName(
            schema.destination
          );
        }
      }
    });
    return json;
  });
}
