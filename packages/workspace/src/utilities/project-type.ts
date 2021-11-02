import type { Tree } from '@nrwl/devkit';
import { joinPathFragments, readProjectConfiguration } from '@nrwl/devkit';

export function getProjectRootPath(tree: Tree, projectName: string): string {
  const { sourceRoot, projectType } = readProjectConfiguration(
    tree,
    projectName
  );

  return joinPathFragments(
    sourceRoot,
    projectType === 'application' ? 'app' : 'lib'
  );
}
