import { existsSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';

export function findFile(
  path: string,
  extensions: string[],
  existsSyncImpl: typeof existsSync = existsSync
): string {
  for (const ext of extensions) {
    // Support file extensions such as .css and .js in the import path.
    const [dir, name] = [
      dirname(path),
      basename(path.replace(/\?\S*$/, ''), ext),
    ];

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
