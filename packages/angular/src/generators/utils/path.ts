import {
  joinPathFragments,
  normalizePath,
  readNxJson,
  readProjectConfiguration,
  Tree,
  workspaceRoot,
} from '@nrwl/devkit';
import { basename, dirname, relative } from 'path';

export function pathStartsWith(path1: string, path2: string): boolean {
  const normalizedPath1 = joinPathFragments(workspaceRoot, path1);
  const normalizedPath2 = joinPathFragments(workspaceRoot, path2);

  return normalizedPath1.startsWith(normalizedPath2);
}

export function getRelativeImportToFile(
  sourceFilePath: string,
  targetFilePath: string
): string {
  const relativeDirToTarget = relative(
    dirname(sourceFilePath),
    dirname(targetFilePath)
  );

  return `./${joinPathFragments(
    relativeDirToTarget,
    basename(targetFilePath, '.ts')
  )}`;
}

export function checkPathUnderProjectRoot(
  tree: Tree,
  projectName: string,
  path: string
): void {
  if (!path) {
    return;
  }

  const { root } = readProjectConfiguration(tree, projectName);

  let pathToComponent = normalizePath(path);
  pathToComponent = pathToComponent.startsWith('/')
    ? pathToComponent.slice(1)
    : pathToComponent;

  if (!pathStartsWith(pathToComponent, root)) {
    throw new Error(
      `The path provided (${path}) does not exist under the project root (${root}). ` +
        `Please make sure to provide a path that exists under the project root.`
    );
  }
}
