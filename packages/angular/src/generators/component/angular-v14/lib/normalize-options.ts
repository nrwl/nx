import type { Tree } from '@nrwl/devkit';
import {
  createProjectGraphAsync,
  joinPathFragments,
  readCachedProjectGraph,
  readProjectConfiguration,
  readWorkspaceConfiguration,
} from '@nrwl/devkit';
import type { NormalizedSchema, Schema } from '../schema';
import {
  createProjectRootMappings,
  findProjectForPath,
} from 'nx/src/project-graph/utils/find-project-for-path';

async function findProjectFromOptions(options: Schema) {
  const projectGraph = await createProjectGraphAsync();
  const projectRootMappings = createProjectRootMappings(projectGraph.nodes);
  return findProjectForPath(options.path, projectRootMappings);
}

export async function normalizeOptions(
  tree: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const project =
    options.project ??
    (await findProjectFromOptions(options)) ??
    readWorkspaceConfiguration(tree).defaultProject;
  const { projectType, root, sourceRoot } = readProjectConfiguration(
    tree,
    project
  );
  const projectSourceRoot = sourceRoot ?? joinPathFragments(root, 'src');
  const path =
    options.path ??
    joinPathFragments(
      projectSourceRoot,
      projectType === 'application' ? 'app' : 'lib'
    );

  return {
    ...options,
    path,
    project,
    projectSourceRoot,
  };
}
