import type { Tree } from '@nrwl/devkit';
import { joinPathFragments, readProjectConfiguration } from '@nrwl/devkit';
import type { AngularProjectConfiguration } from '../../../utils/types';
import { parseNameWithPath } from '../../utils/names';
import { buildSelector } from '../../utils/selector';
import type { Schema } from '../schema';

export function normalizeOptions(tree: Tree, options: Schema) {
  const { prefix, projectType, root, sourceRoot } = readProjectConfiguration(
    tree,
    options.project
  ) as AngularProjectConfiguration;

  const projectSourceRoot = sourceRoot ?? joinPathFragments(root, 'src');
  const { name, path: namePath } = parseNameWithPath(options.name);

  const path =
    options.path ??
    joinPathFragments(
      projectSourceRoot,
      projectType === 'application' ? 'app' : 'lib',
      namePath
    );

  const selector =
    options.selector ??
    buildSelector(tree, name, options.prefix, prefix, 'propertyName');

  return {
    ...options,
    name,
    path,
    projectRoot: root,
    projectSourceRoot,
    selector,
  };
}
