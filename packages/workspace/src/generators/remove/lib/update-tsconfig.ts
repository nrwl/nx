import {
  createProjectGraphAsync,
  normalizePath,
  ProjectGraph,
  readProjectsConfigurationFromProjectGraph,
  Tree,
  updateJson,
} from '@nx/devkit';
import { getRootTsConfigPathInTree } from '../../../utilities/ts-config';
import { Schema } from '../schema';
import {
  createProjectRootMappings,
  findProjectForPath,
} from 'nx/src/project-graph/utils/find-project-for-path';
import { isUsingTsSolutionSetup } from '../../../utilities/typescript/ts-solution-setup';
import { relative } from 'path';

/**
 * Updates the tsconfig paths to remove the project.
 *
 * @param schema The options provided to the schematic
 */
export async function updateTsconfig(tree: Tree, schema: Schema) {
  const isUsingTsSolution = isUsingTsSolutionSetup(tree);
  const tsConfigPath = isUsingTsSolution
    ? 'tsconfig.json'
    : getRootTsConfigPathInTree(tree);

  if (tree.exists(tsConfigPath)) {
    const graph: ProjectGraph = await createProjectGraphAsync();
    const projectMapping = createProjectRootMappings(graph.nodes);
    updateJson(tree, tsConfigPath, (json) => {
      if (isUsingTsSolution) {
        const projectConfigs = readProjectsConfigurationFromProjectGraph(graph);
        const project = projectConfigs.projects[schema.projectName];
        if (!project) {
          throw new Error(
            `Could not find project '${schema.project}'. Please choose a project that exists in the Nx Workspace.`
          );
        }
        json.references = json.references.filter(
          (ref) => relative(ref.path, project.root) !== ''
        );
      } else {
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
      }
      return json;
    });
  }
}
