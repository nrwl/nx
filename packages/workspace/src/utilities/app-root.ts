import { fileExists } from './fileutils';
import * as path from 'path';

/**
 * @deprecated Use appRootPath in tao instead! Will be removed in v13.
 */
export const appRootPath = pathInner(__dirname);

function pathInner(dir: string): string {
  if (process.env.NX_WORKSPACE_ROOT_PATH)
    return process.env.NX_WORKSPACE_ROOT_PATH;
  if (path.dirname(dir) === dir) return process.cwd();
  if (
    fileExists(path.join(dir, 'workspace.json')) ||
    fileExists(path.join(dir, 'angular.json'))
  ) {
    return dir;
  } else {
    return pathInner(path.dirname(dir));
  }
}
