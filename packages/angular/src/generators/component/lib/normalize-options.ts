import type { Tree } from '@nrwl/devkit';
import {
  joinPathFragments,
  readProjectConfiguration,
  readWorkspaceConfiguration,
} from '@nrwl/devkit';
import type { NormalizedSchema, Schema } from '../schema';
import { getProjectNameFromDirPath } from 'nx/src/utils/project-graph-utils';

function getProjectFromPath(path: string) {
  try {
    return getProjectNameFromDirPath(path);
  } catch {
    return null;
  }
}

export function normalizeOptions(
  tree: Tree,
  options: Schema
): NormalizedSchema {
  const project =
    options.project ??
    getProjectFromPath(options.path) ??
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
