import type { ProjectType, Tree } from '@nx/devkit';
import {
  joinPathFragments,
  normalizePath,
  readJson,
  readProjectConfiguration,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { basename, dirname } from 'path';
import { readLibraryBuilderEntryPoints } from '../entry-point';
import { usesLibraryBuilder } from '../project';

export type EntryPoint = { name: string; path: string; excludeDirs?: string[] };

export function getProjectEntryPoints(
  tree: Tree,
  projectName: string
): EntryPoint[] {
  const { root, sourceRoot, projectType } = readProjectConfiguration(
    tree,
    projectName
  );

  const rootEntryPoint: EntryPoint = {
    name: '',
    path: normalizeMainEntryPointSourceRoot(
      tree,
      root,
      sourceRoot,
      projectType
    ),
  };
  const entryPointRootPaths = [rootEntryPoint];

  if (projectType === 'application') {
    return entryPointRootPaths;
  }

  collectLibrarySecondaryEntryPoints(tree, root, entryPointRootPaths);
  if (usesLibraryBuilder(tree, projectName)) {
    collectLibraryBuilderSecondaryEntryPoints(tree, root, entryPointRootPaths);
  }

  // since the root includes some secondary entry points, we need to ignore
  // them when processing the main entry point. The trailing slash keeps a
  // sibling such as testing-utils/ when testing/ is ignored.
  if (rootEntryPoint.path === root && entryPointRootPaths.length > 1) {
    rootEntryPoint.excludeDirs = entryPointRootPaths
      .slice(1)
      .map((entryPoint) => `${entryPoint.path}/`);
  }

  return entryPointRootPaths;
}

function collectLibrarySecondaryEntryPoints(
  tree: Tree,
  root: string,
  entryPointPaths: EntryPoint[]
): void {
  const exclude = new Set([`${root}/ng-package.json`, `${root}/package.json`]);

  visitNotIgnoredFiles(tree, root, (path) => {
    const normalizedPath = normalizePath(path);

    if (!tree.isFile(normalizedPath) || exclude.has(normalizedPath)) {
      return;
    }

    const fileName = basename(normalizedPath);
    if (
      fileName !== 'ng-package.json' &&
      (fileName !== 'package.json' ||
        (fileName === 'package.json' &&
          !readJson(tree, normalizedPath).ngPackage))
    ) {
      return;
    }

    const entryPointPath = getSourcePath(
      tree,
      normalizePath(dirname(normalizedPath)),
      'lib'
    );

    entryPointPaths.push({
      name: basename(dirname(normalizedPath)),
      path: entryPointPath,
    });
  });
}

function collectLibraryBuilderSecondaryEntryPoints(
  tree: Tree,
  root: string,
  entryPointPaths: EntryPoint[]
): void {
  for (const { subpath, entryFile } of readLibraryBuilderEntryPoints(
    tree,
    root
  )) {
    if (subpath === '.') {
      continue;
    }

    const entryPointPath = getSourcePath(tree, dirname(entryFile), 'lib');
    if (
      entryPointPath &&
      !entryPointPaths.some(({ path }) => path === entryPointPath)
    ) {
      entryPointPaths.push({ name: subpath.slice(2), path: entryPointPath });
    }
  }
}

function normalizeMainEntryPointSourceRoot(
  tree: Tree,
  root: string,
  sourceRoot: string,
  projectType: ProjectType
): string {
  const projectTypeDir = projectType === 'application' ? 'app' : 'lib';

  if (sourceRoot) {
    return [joinPathFragments(sourceRoot, projectTypeDir), sourceRoot].find(
      (path) => tree.exists(path)
    );
  }

  return getSourcePath(tree, root, projectTypeDir) ?? root;
}

function getSourcePath(
  tree: Tree,
  basePath: string,
  projectTypeDir: string
): string | undefined {
  const candidatePaths = [
    joinPathFragments(basePath, 'src', projectTypeDir),
    joinPathFragments(basePath, 'src'),
    joinPathFragments(basePath, projectTypeDir),
    basePath,
  ];

  return candidatePaths.find((candidatePath) => tree.exists(candidatePath));
}
