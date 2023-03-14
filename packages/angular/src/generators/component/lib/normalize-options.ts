import type { Tree } from '@nrwl/devkit';
import { joinPathFragments, readProjectConfiguration } from '@nrwl/devkit';
import type { NormalizedSchema, Schema } from '../schema';

export async function normalizeOptions(
  tree: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const { projectType, root, sourceRoot } = readProjectConfiguration(
    tree,
    options.project
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
    projectSourceRoot,
  };
}
