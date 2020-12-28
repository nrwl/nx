import { normalize, sep } from 'path';

/**
 * Calculates an offset from the root of the workspace, which is useful for
 * constructing relative URLs.
 *
 * Examples:
 *
 * ```typescript
 * offsetFromRoot("apps/mydir/myapp/") // returns "../../../"
 * ```
 *
 * @param fullPathToDir - directory path
 */
export function offsetFromRoot(fullPathToDir: string): string {
  const parts = normalize(fullPathToDir).split(sep);
  let offset = '';
  for (let i = 0; i < parts.length; ++i) {
    if (parts[i].length > 0) {
      offset += '../';
    }
  }
  return offset;
}
