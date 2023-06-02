import type { Tree } from '@nx/devkit';
import { getProjectPrefix } from '../../utils/project';
import type { NormalizedOptions, Schema } from '../schema';

export function normalizeOptions(
  tree: Tree,
  options: Schema
): NormalizedOptions {
  return {
    ...options,
    federationType: options.federationType ?? 'static',
    prefix: options.prefix ?? getProjectPrefix(tree, options.appName),
  };
}
