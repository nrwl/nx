import type { ProjectConfiguration, Tree } from '@nrwl/devkit';
import { joinPathFragments, readProjectConfiguration } from '@nrwl/devkit';
import { parseName } from '../../utils/names';
import { buildSelector } from '../../utils/selector';
import type { NormalizedSchema, Schema } from '../schema';

export function normalizeOptions(
  tree: Tree,
  options: Schema
): NormalizedSchema {
  const { prefix, projectType, root, sourceRoot } = readProjectConfiguration(
    tree,
    options.project
  ) as ProjectConfiguration & { prefix?: string };

  const projectSourceRoot = sourceRoot ?? joinPathFragments(root, 'src');
  const { name, path: namePath } = parseName(options.name);

  const path =
    options.path ??
    joinPathFragments(
      projectSourceRoot,
      projectType === 'application' ? 'app' : 'lib',
      namePath
    );

  const selector =
    options.selector ??
    buildSelector(tree, name, options.prefix, prefix, 'fileName');

  return {
    ...options,
    name,
    type: options.type ?? 'component',
    changeDetection: options.changeDetection ?? 'Default',
    style: options.style ?? 'css',
    path,
    projectSourceRoot,
    projectRoot: root,
    selector,
  };
}
