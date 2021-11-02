import * as path from 'path';
import { statSync } from 'fs';

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

export function fileExists(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
}
