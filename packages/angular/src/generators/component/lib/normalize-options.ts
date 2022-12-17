import type { Tree } from '@nrwl/devkit';
import {
  createProjectGraphAsync,
  joinPathFragments,
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

  // path can be undefined when running on the root of the workspace, we default to the root
  // to handle standalone layouts
  return findProjectForPath(options.path || '', projectRootMappings);
}

export async function normalizeOptions(
  tree: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const project =
    options.project ??
    (await findProjectFromOptions(options)) ??
    readWorkspaceConfiguration(tree).defaultProject;

  if (!project) {
    // path is hidden, so if not provided we don't suggest setting it
    if (!options.path) {
      throw new Error(
        'No "project" was specified and "defaultProject" is not set in the workspace configuration. Please provide the "project" option and try again.'
      );
    }

    // path was provided, so it's wrong and we should mention it
    throw new Error(
      'The provided "path" is wrong and no "project" was specified and "defaultProject" is not set in the workspace configuration. ' +
        'Please provide a correct "path" or provide the "project" option instead and try again.'
    );
  }

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
