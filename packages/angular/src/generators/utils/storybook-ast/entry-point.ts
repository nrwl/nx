import type { ProjectType, Tree } from '@nx/devkit';
import {
  joinPathFragments,
  normalizePath,
  readJson,
  readProjectConfiguration,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { basename, dirname } from 'path';

export type EntryPoint = { name: string; path: string; excludeDirs?: string[] };

export function getProjectEntryPoints(
  tree: Tree,
  projectName: string
): EntryPoint[] {
  const { root, sourceRoot, projectType } = readProjectConfiguration(
    tree,
    projectName
  );

  const rootEntryPointPath = normalizeMainEntryPointSourceRoot(
    tree,
    root,
    sourceRoot,
    projectType
  );
  if (!rootEntryPointPath) {
    throw new Error(
      `Cannot find the source directory of the "${projectName}" project.`
    );
  }
  const rootEntryPoint: EntryPoint = { name: '', path: rootEntryPointPath };
  const entryPointRootPaths = [rootEntryPoint];

  if (projectType === 'application') {
    return entryPointRootPaths;
  }

  collectLibrarySecondaryEntryPoints(tree, root, entryPointRootPaths);

  // since the root includes some secondary entry points, we need to ignore
  // them when processing the main entry point
  if (rootEntryPoint.path === root && entryPointRootPaths.length > 1) {
    rootEntryPoint.excludeDirs = entryPointRootPaths
      .slice(1)
      .map((entryPoint) => entryPoint.path);
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

function normalizeMainEntryPointSourceRoot(
  tree: Tree,
  root: string,
  sourceRoot: string | undefined,
  projectType: ProjectType | undefined
): string | undefined {
  const projectTypeDir = projectType === 'application' ? 'app' : 'lib';

  if (sourceRoot) {
    return [joinPathFragments(sourceRoot, projectTypeDir), sourceRoot].find(
      (path) => tree.exists(path)
    );
  }

  return getSourcePath(tree, root, projectTypeDir);
}

function getSourcePath(
  tree: Tree,
  basePath: string,
  projectTypeDir: string
): string {
  const candidatePaths = [
    joinPathFragments(basePath, 'src', projectTypeDir),
    joinPathFragments(basePath, 'src'),
    joinPathFragments(basePath, projectTypeDir),
    basePath,
  ];

  return (
    candidatePaths.find((candidatePath) => tree.exists(candidatePath)) ??
    basePath
  );
}
