import type { Tree } from '@nx/devkit';
import { readProjectConfiguration } from '@nx/devkit';
import type { AngularProjectConfiguration } from '../../utils/types';

export function getProjectPrefix(
  tree: Tree,
  project: string
): string | undefined {
  return (
    readProjectConfiguration(tree, project) as AngularProjectConfiguration
  ).prefix;
}
