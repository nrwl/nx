import { getWorkspacePath, Tree, updateJson } from '@nrwl/devkit';
import { Schema } from '../schema';
import { getNewProjectName } from './utils';

/**
 * Update other references to the source project's targets
 */
export function updateBuildTargets(tree: Tree, schema: Schema) {
  const newProjectName = getNewProjectName(schema.destination);

  updateJson(tree, getWorkspacePath(tree), (json) => {
    const strWorkspace = JSON.stringify(json);
    json = JSON.parse(
      strWorkspace.replace(
        new RegExp(`${schema.projectName}:`, 'g'),
        `${newProjectName}:`
      )
    );
    return json;
  });
}
