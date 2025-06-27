import {
  joinPathFragments,
  workspaceRoot,
  type ProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { FsTree } from 'nx/src/generators/tree';

export function getProjectSourceRoot(
  project: ProjectConfiguration,
  tree?: Tree
): string {
  tree ??= new FsTree(workspaceRoot, false);

  return (
    project.sourceRoot ??
    (tree.exists(joinPathFragments(project.root, 'src'))
      ? joinPathFragments(project.root, 'src')
      : project.root)
  );
}
