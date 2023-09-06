import { dirname, relative } from 'path';
import { normalizePath } from 'nx/src/utils/path';

export function getRelativeDirectoryToProjectRoot(
  file: string,
  projectRoot: string
): string {
  const dir = dirname(file);
  const relativeDir = normalizePath(relative(projectRoot, dir));
  return relativeDir === '' ? `./` : `./${relativeDir}/`;
}
