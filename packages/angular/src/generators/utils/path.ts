import { joinPathFragments } from '@nrwl/devkit';
import { basename, dirname, normalize, relative } from 'path';

export function pathStartsWith(path1: string, path2: string) {
  path1 = normalize(path1).replace(/\\/g, '/');
  path2 = normalize(path2).replace(/\\/g, '/');

  return path1.startsWith(path2);
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
