import { fileExists } from './fileutils';
import * as path from 'path';

export const appRootPath = pathInner(__dirname);

function pathInner(dir: string): string {
  if (path.dirname(dir) === dir) return process.cwd();
  if (fileExists(path.join(dir, 'angular.json'))) {
    return dir;
  } else {
    return pathInner(path.dirname(dir));
  }
}

export function closestCli(dir: string): string {
  if (path.dirname(dir) === dir) {
    throw new Error(`Cannot find the Angular CLI to invoke the command`);
  }
  const cliPath = path.join(
    dir,
    'node_modules',
    '@angular',
    'cli',
    'lib',
    'init.js'
  );
  if (fileExists(cliPath)) {
    return cliPath;
  } else {
    return closestCli(path.dirname(dir));
  }
}
