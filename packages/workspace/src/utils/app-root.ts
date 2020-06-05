import { fileExists } from './fileutils';
import * as path from 'path';

export const appRootPath = pathInner(__dirname);

function pathInner(dir: string): string {
  if (path.dirname(dir) === dir) return process.cwd();
  if (
    fileExists(path.join(dir, 'workspace.json')) ||
    fileExists(path.join(dir, 'angular.json'))
  ) {
    // unit test
    if (process.argv[1].indexOf('jest-worker') > -1) {
      return `${dir}/tmp/unit`;
    } else {
      return dir;
    }
  } else {
    return pathInner(path.dirname(dir));
  }
}
