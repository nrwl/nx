import {
  detectPackageManager,
  globAsync,
  readJson,
  type Tree,
  workspaceRoot,
} from '@nx/devkit';
import { dirname } from 'node:path/posix';
import { FsTree } from 'nx/src/generators/tree';
import { type PackageJson } from 'nx/src/utils/package-json';
import {
  getPackageManagerWorkspacesPatterns,
  isProjectIncludedInPackageManagerWorkspaces,
} from '../package-manager-workspaces';

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

export async function addProjectToTsSolutionWorkspace(
  tree: Tree,
  projectDir: string
) {
  const isIncluded = isProjectIncludedInPackageManagerWorkspaces(
    tree,
    projectDir
  );
  if (isIncluded) {
    return;
  }

  // If dir is "libs/foo", we try to use "libs/*" but we only do it if it's
  // safe to do so. So, we first check if adding that pattern doesn't result
  // in extra projects being matched. If extra projects are matched, or the
  // dir is just "foo" then we add it as is.
  const baseDir = dirname(projectDir);
  let pattern = projectDir;
  if (baseDir !== '.') {
    const patterns = getPackageManagerWorkspacesPatterns(tree);
    const projectsBefore = await globAsync(tree, patterns);
    patterns.push(`${baseDir}/*/package.json`);
    const projectsAfter = await globAsync(tree, patterns);

    if (projectsBefore.length + 1 === projectsAfter.length) {
      // Adding the pattern to the parent directory only results in one extra
      // project being matched, which is the project we're adding. It's safe
      // to add the pattern to the parent directory.
      pattern = `${baseDir}/*`;
    }
  }

  if (tree.exists('pnpm-workspace.yaml')) {
    const { load, dump } = require('@zkochan/js-yaml');
    const workspaceFile = tree.read('pnpm-workspace.yaml', 'utf-8');
    const yamlData = load(workspaceFile) ?? {};
    yamlData.packages ??= [];

    if (!yamlData.packages.includes(pattern)) {
      yamlData.packages.push(pattern);
      tree.write(
        'pnpm-workspace.yaml',
        dump(yamlData, { indent: 2, quotingType: '"', forceQuotes: true })
      );
    }
  } else {
    // Update package.json
    const packageJson = readJson(tree, 'package.json');
    if (!packageJson.workspaces) {
      packageJson.workspaces = [];
    }

    if (!packageJson.workspaces.includes(pattern)) {
      packageJson.workspaces.push(pattern);
      tree.write('package.json', JSON.stringify(packageJson, null, 2));
    }
  }
}
