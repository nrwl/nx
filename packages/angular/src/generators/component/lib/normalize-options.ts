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
  options.type ??= 'component';
  const { directory, filePath, name, path, root, sourceRoot } =
    normalizeNameAndPaths(tree, options);

  const { prefix } = readProjectConfiguration(
    tree,
    options.project
  ) as AngularProjectConfiguration;

  const selector =
    options.selector ??
    buildSelector(tree, name, options.prefix, prefix, 'fileName');

  return {
    ...options,
    name,
    changeDetection: options.changeDetection ?? 'Default',
    style: options.style ?? 'css',
    flat: options.flat ?? false,
    directory,
    filePath,
    path,
    projectSourceRoot: sourceRoot,
    projectRoot: root,
    selector,
  };
}
