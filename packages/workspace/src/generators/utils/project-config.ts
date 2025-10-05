import {
  joinPathFragments,
  workspaceRoot,
  type ProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function getProjectSourceRoot(
  project: ProjectConfiguration,
  tree?: Tree
): string {
  if (tree) {
    return (
      project.sourceRoot ??
      (tree.exists(joinPathFragments(project.root, 'src'))
        ? joinPathFragments(project.root, 'src')
        : project.root)
    );
  }

  return (
    project.sourceRoot ??
    (existsSync(join(workspaceRoot, project.root, 'src'))
      ? joinPathFragments(project.root, 'src')
      : project.root)
  );
}
