import { NxJson, updateJsonInTree } from '@nrwl/workspace';
import { Schema } from '../schema';
import { getNewProjectName } from './utils';

/**
 * Updates the nx.json file by renaming the project
 *
 * @param schema The options provided to the schematic
 */
export function updateNxJson(schema: Schema) {
  return updateJsonInTree<NxJson>('nx.json', (json) => {
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
    json.projects[getNewProjectName(schema.destination)] = {
      ...json.projects[schema.projectName],
    };
    delete json.projects[schema.projectName];
    return json;
  });
}
