import type { Tree } from '@nx/devkit';
import { normalizeNameAndPaths } from '../../utils/path';
import type { NormalizedSchema, Schema } from '../schema';

export function normalizeOptions(
  tree: Tree,
  options: Schema
): NormalizedSchema {
  const { directory, filePath, name, path, root, sourceRoot } =
    normalizeNameAndPaths(tree, { ...options, flat: true });

  return {
    ...options,
    name,
    directory,
    filePath,
    path,
    projectSourceRoot: sourceRoot,
    projectRoot: root,
  };
}
