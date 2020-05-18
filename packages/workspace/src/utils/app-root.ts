import { fileExists } from './fileutils';
import * as path from 'path';

function normalizeBackslashes(dir) {
	return dir.replace(/\\/g,'/')
}

export const appRootPath = normalizeBackslashes(pathInner(__dirname));

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
