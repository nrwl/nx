/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { existsSync } from 'fs';
import * as glob from 'glob';
import { basename, dirname, extname, join } from 'path';
import { isDirectory } from './is-directory';

// go through all patterns and find unique list of files
export function findTests(patterns: string[], cwd: string, workspaceRoot: string): string[] {
  return patterns.reduce(
    (files, pattern) => {
      const relativePathToMain = cwd.replace(workspaceRoot, '').substr(1); // remove leading slash
      const tests = findMatchingTests(pattern, cwd, relativePathToMain);
      tests.forEach(file => {
        if (!files.includes(file)) {
          files.push(file);
        }
      });

      return files;
    },
    [] as string[],
  );
}

function findMatchingTests(pattern: string, cwd: string, relativePathToMain: string): string[] {
  // normalize pattern, glob lib only accepts forward slashes
  pattern = pattern.replace(/\\/g, '/');
  relativePathToMain = relativePathToMain.replace(/\\/g, '/');

  // remove relativePathToMain to support relative paths from root
  // such paths are easy to get when running scripts via IDEs
  if (pattern.startsWith(relativePathToMain + '/')) {
    pattern = pattern.substr(relativePathToMain.length + 1); // +1 to include slash
  }

  // special logic when pattern does not look like a glob
  if (!glob.hasMagic(pattern)) {
    if (isDirectory(join(cwd, pattern))) {
      pattern = `${pattern}/**/*.spec.@(ts|tsx)`;
    } else {
      // see if matching spec file exists
      const extension = extname(pattern);
      const matchingSpec = `${basename(pattern, extension)}.spec${extension}`;

      if (existsSync(join(cwd, dirname(pattern), matchingSpec))) {
        pattern = join(dirname(pattern), matchingSpec).replace(/\\/g, '/');
      }
    }
  }

  const files = glob.sync(pattern, {
    cwd,
  });

  return files;
}
