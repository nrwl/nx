import { join } from 'path';
import { workspaceRoot } from './workspace-root';

export function getNxInstallationPath(root: string = workspaceRoot) {
  return join(root, '.nx', 'installation');
}

export function getNxRequirePaths(root: string = workspaceRoot) {
  return [getNxInstallationPath(root), root];
}

/**
 * Resolves a package the workspace provides (typescript, a release version
 * actions implementation, ...) from the workspace first, then from this nx
 * installation. A package manager's global or content-addressed store links nx
 * only to its own dependencies, so resolving from nx's location alone cannot
 * see what the workspace installs.
 */
export function resolveFromWorkspace(
  specifier: string,
  root: string = workspaceRoot
): string {
  return require.resolve(specifier, {
    paths: [...getNxRequirePaths(root), __dirname],
  });
}
