import type { Tree } from '@nx/devkit';
import { normalizeNameAndPaths } from '../../utils/path';
import type { NormalizedSchema, Schema } from '../schema';

export function normalizeOptions(
  tree: Tree,
  options: Schema
): NormalizedSchema {
  const { directory, name, path } = normalizeNameAndPaths(tree, {
    ...options,
    type: 'pipe',
  });

  return {
    ...options,
    directory,
    name,
    path,
  };
}
