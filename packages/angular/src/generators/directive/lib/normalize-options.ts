import type { Tree } from '@nx/devkit';
import { readProjectConfiguration } from '@nx/devkit';
import type { AngularProjectConfiguration } from '../../../utils/types';
import { normalizeNameAndPaths } from '../../utils/path';
import { buildSelector } from '../../utils/selector';
import type { NormalizedSchema, Schema } from '../schema';

export function normalizeOptions(
  tree: Tree,
  options: Schema
): NormalizedSchema {
  const { directory, name, path } = normalizeNameAndPaths(tree, {
    ...options,
    type: 'directive',
  });

  const { prefix } = readProjectConfiguration(
    tree,
    options.project
  ) as AngularProjectConfiguration;

  const selector =
    options.selector ??
    buildSelector(tree, name, options.prefix, prefix, 'propertyName');

  return {
    ...options,
    directory,
    name,
    path,
    selector,
  };
}
