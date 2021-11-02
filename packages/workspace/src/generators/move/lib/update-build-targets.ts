import { getWorkspacePath, Tree, updateJson } from '@nrwl/devkit';
import { NormalizedSchema } from '../schema';

/**
 * Update other references to the source project's targets
 */
export function updateBuildTargets(tree: Tree, schema: NormalizedSchema) {
  updateJson(tree, getWorkspacePath(tree), (json) => {
    const strWorkspace = JSON.stringify(json);
    json = JSON.parse(
      strWorkspace.replace(
        new RegExp(`${schema.projectName}:`, 'g'),
        `${schema.newProjectName}:`
      )
    );
    return json;
  });
}
