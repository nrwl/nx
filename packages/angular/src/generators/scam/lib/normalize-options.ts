import type { Tree } from '@nrwl/devkit';
import { joinPathFragments, readProjectConfiguration } from '@nrwl/devkit';
import type { NormalizedSchema, Schema } from '../schema';

export function normalizeOptions(
  tree: Tree,
  options: Schema
): NormalizedSchema {
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
    export: options.export ?? true,
    inlineScam: options.inlineScam ?? true,
    path,
    projectSourceRoot,
  };
}
