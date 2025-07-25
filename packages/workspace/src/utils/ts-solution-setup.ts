import { joinPathFragments, readJson, type Tree } from '@nx/devkit';

// This is copied from `@nx/js` to avoid circular dependencies.
export function getProjectType(
  tree: Tree,
  projectRoot: string,
  projectType?: 'library' | 'application'
): 'library' | 'application' {
  if (projectType) return projectType;
  if (joinPathFragments(projectRoot, 'tsconfig.lib.json')) return 'library';
  if (joinPathFragments(projectRoot, 'tsconfig.app.json')) return 'application';
  // If it doesn't have any common library entry points, assume it is an application
  const packageJsonPath = joinPathFragments(projectRoot, 'package.json');
  const packageJson = tree.exists(packageJsonPath)
    ? readJson(tree, joinPathFragments(projectRoot, 'package.json'))
    : null;
  if (
    !packageJson?.exports &&
    !packageJson?.main &&
    !packageJson?.module &&
    !packageJson?.bin
  ) {
    return 'application';
  }
  return 'library';
}
