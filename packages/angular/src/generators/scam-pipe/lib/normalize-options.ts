import type { Tree } from '@nrwl/devkit';
import {
  joinPathFragments,
  readProjectConfiguration,
  readWorkspaceConfiguration,
} from '@nrwl/devkit';
import type { NormalizedSchema, Schema } from '../schema';

export function normalizeOptions(
  tree: Tree,
  options: Schema
): NormalizedSchema {
  const project =
    options.project ?? readWorkspaceConfiguration(tree).defaultProject;
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
    flat: options.flat ?? true,
    path,
    project,
    projectSourceRoot,
  };
}
