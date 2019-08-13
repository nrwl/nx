import { fileExists } from './fileutils';
import * as path from 'path';

// TODO: vsavkin normalize the path
export const appRootPath = pathInner(__dirname);

function pathInner(dir: string): string {
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
