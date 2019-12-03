/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as path from 'path';
import * as ts from 'typescript';
/**
 * Reads and parses a given TsConfig file.
 *
 * @param tsconfigPath - An absolute or relative path from 'workspaceRoot' of the tsconfig file.
 * @param workspaceRoot - workspaceRoot root location when provided
 * it will resolve 'tsconfigPath' from this path.
 */
export function readTsconfig(
  tsconfigPath: string,
  workspaceRoot?: string
): any {
  const tsConfigFullPath = workspaceRoot
    ? path.resolve(workspaceRoot, tsconfigPath)
    : tsconfigPath;

  return ts.readConfigFile(tsConfigFullPath, ts.sys.readFile);
}
