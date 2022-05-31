import { joinPathFragments } from '@nrwl/devkit';
import { basename, dirname, relative } from 'path';

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
