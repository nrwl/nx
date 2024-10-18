import { existsSync } from 'node:fs';
import { parse, resolve } from 'node:path';

export function findFile(
  /**
   * File path without extension
   */
  path: string,
  extensions: string[],
  existsSyncImpl: typeof existsSync = existsSync
): string {
  for (const ext of extensions) {
    /**
     * Support file extensions such as .css and .js in the import path.
     *
     *  NOTE: We should concatenate the `path` with `ext` because filenames with dot suffixes, e.g., `filename.suffix`, resolve incorrectly.
     */
    const { dir, name } = parse(path + ext);
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
