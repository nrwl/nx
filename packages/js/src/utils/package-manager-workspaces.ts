import {
  detectPackageManager,
  isWorkspacesEnabled,
  readJson,
  type Tree,
} from '@nx/devkit';
import { minimatch } from 'minimatch';
import { join } from 'node:path/posix';
import { getGlobPatternsFromPackageManagerWorkspaces } from 'nx/src/plugins/package-json';

export type ProjectPackageManagerWorkspaceState =
  | 'included'
  | 'excluded'
  | 'no-workspaces';

export function getProjectPackageManagerWorkspaceState(
  tree: Tree,
  projectRoot: string
): ProjectPackageManagerWorkspaceState {
  if (!isUsingPackageManagerWorkspaces(tree)) {
    return 'no-workspaces';
  }

  const patterns = getGlobPatternsFromPackageManagerWorkspaces(
    tree.root,
    (path) => readJson(tree, path, { expectComments: true })
  );
  const isIncluded = patterns.some((p) =>
    minimatch(join(projectRoot, 'package.json'), p)
  );

  return isIncluded ? 'included' : 'excluded';
}

export function isUsingPackageManagerWorkspaces(tree: Tree): boolean {
  return isWorkspacesEnabled(detectPackageManager(tree.root), tree.root);
}
