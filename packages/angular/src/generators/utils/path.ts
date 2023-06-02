import type { Tree } from '@nx/devkit';
import {
  joinPathFragments,
  names,
  normalizePath,
  readProjectConfiguration,
  workspaceRoot,
} from '@nx/devkit';
import { basename, dirname, relative } from 'path';
import { parseNameWithPath } from './names';

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

export type PathGenerationOptions = {
  name: string;
  project: string;
  flat?: boolean;
  path?: string;
  type?: string;
};

export type GenerationPaths = {
  directory: string;
  fileName: string;
  filePath: string;
  name: string;
  path: string;
  root: string;
  sourceRoot: string;
};

export function normalizeNameAndPaths(
  tree: Tree,
  options: PathGenerationOptions
): GenerationPaths {
  const { root, sourceRoot, projectType } = readProjectConfiguration(
    tree,
    options.project
  );

  const projectSourceRoot = sourceRoot ?? joinPathFragments(root, 'src');
  const { name, path: namePath } = parseNameWithPath(options.name);

  const path =
    options.path ??
    joinPathFragments(
      projectSourceRoot,
      projectType === 'application' ? 'app' : 'lib',
      namePath
    );

  const directory = options.flat
    ? normalizePath(path)
    : joinPathFragments(path, name);

  const fileName = options.type
    ? `${name}.${names(options.type).fileName}`
    : name;

  const filePath = joinPathFragments(directory, `${fileName}.ts`);

  return {
    directory,
    fileName,
    filePath,
    name,
    path,
    root,
    sourceRoot,
  };
}
