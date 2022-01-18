import {
  getWorkspaceLayout,
  ProjectConfiguration,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { Schema } from '../schema';

/**
 * Updates the tsconfig paths to remove the project.
 *
 * @param schema The options provided to the schematic
 */
export function updateTsconfig(
  tree: Tree,
  schema: Schema,
  project: ProjectConfiguration
) {
  const { appsDir, libsDir, npmScope } = getWorkspaceLayout(tree);

  const tsConfigPath = 'tsconfig.base.json';
  if (tree.exists(tsConfigPath)) {
    updateJson(tree, tsConfigPath, (json) => {
      delete json.compilerOptions.paths[
        `@${npmScope}/${project.root.substring(
          project.projectType === 'application'
            ? appsDir.length + 1
            : libsDir.length + 1
        )}`
      ];

      return json;
    });
  }
}
