import {
  getImportPath,
  getWorkspaceLayout,
  ProjectConfiguration,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { getRootTsConfigPathInTree } from '../../../utilities/typescript';
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

  const tsConfigPath = getRootTsConfigPathInTree(tree);
  const defaultImportPath = getImportPath(
    npmScope,
    project.root.slice(
      project.projectType === 'application'
        ? appsDir.length + 1
        : libsDir.length + 1
    )
  );
  const importPath = schema.importPath || defaultImportPath;
  if (tree.exists(tsConfigPath)) {
    updateJson(tree, tsConfigPath, (json) => {
      delete json.compilerOptions.paths[importPath];
      return json;
    });
  }
}
