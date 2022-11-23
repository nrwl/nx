import type { Tree } from '@nrwl/devkit';
import {
  joinPathFragments,
  readCachedProjectGraph,
  readProjectConfiguration,
  readWorkspaceConfiguration,
} from '@nrwl/devkit';
import type { NormalizedSchema, Schema } from '../schema';
import {
  createProjectPathMappings,
  getProjectForPath,
} from 'nx/src/project-graph/utils/get-project';

export function normalizeOptions(
  tree: Tree,
  options: Schema
): NormalizedSchema {
  const projectGraph = readCachedProjectGraph();
  const projectPathMappings = createProjectPathMappings(projectGraph.nodes);
  const project =
    options.project ??
    getProjectForPath(options.path, projectPathMappings) ??
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
