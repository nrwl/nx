import {
  createProjectGraphAsync,
  normalizePath,
  ProjectGraph,
  Tree,
  updateJson,
} from '@nx/devkit';
import { getRootTsConfigPathInTree } from '../../../utilities/ts-config';
import { Schema } from '../schema';
import {
  createProjectRootMappings,
  findProjectForPath,
} from 'nx/src/project-graph/utils/find-project-for-path';

/**
 * Updates the tsconfig paths to remove the project.
 *
 * @param schema The options provided to the schematic
 */
export async function updateTsconfig(tree: Tree, schema: Schema) {
  const tsConfigPath = getRootTsConfigPathInTree(tree);

  if (tree.exists(tsConfigPath)) {
    const graph: ProjectGraph = await createProjectGraphAsync();
    const projectMapping = createProjectRootMappings(graph.nodes);
    updateJson(tree, tsConfigPath, (json) => {
      for (const importPath in json.compilerOptions.paths) {
        for (const path of json.compilerOptions.paths[importPath]) {
          const project = findProjectForPath(
            normalizePath(path),
            projectMapping
          );
          if (project === schema.projectName) {
            delete json.compilerOptions.paths[importPath];
            break;
          }
        }
      }
      return json;
    });
  }
}
