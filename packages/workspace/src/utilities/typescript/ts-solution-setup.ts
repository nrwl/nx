import {
  detectPackageManager,
  readJson,
  type Tree,
  workspaceRoot,
} from '@nx/devkit';
import { FsTree } from 'nx/src/generators/tree';
import { type PackageJson } from 'nx/src/utils/package-json';

function isUsingPackageManagerWorkspaces(tree: Tree): boolean {
  return isWorkspacesEnabled(tree);
}

function isWorkspacesEnabled(tree: Tree): boolean {
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

function isWorkspaceSetupWithTsSolution(tree: Tree): boolean {
  if (!tree.exists('tsconfig.base.json') || !tree.exists('tsconfig.json')) {
    return false;
  }

  const tsconfigJson = readJson(tree, 'tsconfig.json');
  if (tsconfigJson.extends !== './tsconfig.base.json') {
    return false;
  }

  /**
   * New setup:
   * - `files` is defined and set to an empty array
   * - `references` is defined and set to an empty array
   * - `include` is not defined or is set to an empty array
   */
  if (
    !tsconfigJson.files ||
    tsconfigJson.files.length > 0 ||
    !tsconfigJson.references ||
    !!tsconfigJson.include?.length
  ) {
    return false;
  }

  const baseTsconfigJson = readJson(tree, 'tsconfig.base.json');
  if (
    !baseTsconfigJson.compilerOptions ||
    !baseTsconfigJson.compilerOptions.composite ||
    !baseTsconfigJson.compilerOptions.declaration
  ) {
    return false;
  }

  const { compilerOptions, ...rest } = baseTsconfigJson;
  if (Object.keys(rest).length > 0) {
    return false;
  }

  return true;
}

export function isUsingTsSolutionSetup(tree?: Tree): boolean {
  tree ??= new FsTree(workspaceRoot, false);

  return (
    isUsingPackageManagerWorkspaces(tree) &&
    isWorkspaceSetupWithTsSolution(tree)
  );
}
