import type { Tree } from '@nrwl/devkit';
import {
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

export function normalizeOptions(
  tree: Tree,
  options: Schema
): NormalizedSchema {
  const projectGraph = readCachedProjectGraph();
  const projectRootMappings = createProjectRootMappings(projectGraph.nodes);
  const project =
    options.project ??
    findProjectForPath(options.path, projectRootMappings) ??
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
