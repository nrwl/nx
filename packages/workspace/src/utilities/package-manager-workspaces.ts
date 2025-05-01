import { detectPackageManager, readJson, type Tree } from '@nx/devkit';
import { join } from 'node:path/posix';
import { getGlobPatternsFromPackageManagerWorkspaces } from 'nx/src/plugins/package-json';
import { PackageJson } from 'nx/src/utils/package-json';
import picomatch = require('picomatch');

export function isProjectIncludedInPackageManagerWorkspaces(
  tree: Tree,
  projectRoot: string
): boolean {
  if (!isUsingPackageManagerWorkspaces(tree)) {
    return false;
  }

  const patterns = getPackageManagerWorkspacesPatterns(tree);

  return patterns.some((p) => picomatch(p)(join(projectRoot, 'package.json')));
}

export function getPackageManagerWorkspacesPatterns(tree: Tree): string[] {
  return getGlobPatternsFromPackageManagerWorkspaces(
    tree.root,
    (path) => readJson(tree, path, { expectComments: true }),
    (path) => {
      const content = tree.read(path, 'utf-8');
      const { load } = require('@zkochan/js-yaml');
      return load(content, { filename: path });
    },
    (path) => tree.exists(path)
  );
}

export function isUsingPackageManagerWorkspaces(tree: Tree): boolean {
  return isWorkspacesEnabled(tree);
}

export function isWorkspacesEnabled(tree: Tree): boolean {
  const packageManager = detectPackageManager(tree.root);
  if (packageManager === 'pnpm') {
    return tree.exists('pnpm-workspace.yaml');
  }

  // yarn and npm both use the same 'workspaces' property in package.json
  if (tree.exists('package.json')) {
    const packageJson = readJson<PackageJson>(tree, 'package.json');
    return !!packageJson?.workspaces;
  }
  return false;
}
