import { existsSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';

export function findFile(
  path: string,
  extensions: string[],
  existsSyncImpl: typeof existsSync = existsSync
): string {
  const queryLessPath = path.replace(/\?\S*$/, '');

  for (const ext of extensions) {
    const dir = dirname(path);
    // Support file extensions such as .css and .js in the import path.
    // While still allowing for '.suffix'
    const name = basename(queryLessPath, ext);

    const resolvedPath = resolve(dir, name + ext);
    if (existsSyncImpl(resolvedPath)) {
      return resolvedPath;
    }

    const resolvedIndexPath = resolve(path, `index${ext}`);
    if (existsSyncImpl(resolvedIndexPath)) {
      return resolvedIndexPath;
    }
  }
}
