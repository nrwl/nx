/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { ParsedConfiguration } from '@angular/compiler-cli';
import * as path from 'path';

/**
 * Reads and parses a given TsConfig file.
 *
 * @param tsconfigPath - An absolute or relative path from 'workspaceRoot' of the tsconfig file.
 * @param workspaceRoot - workspaceRoot root location when provided
 * it will resolve 'tsconfigPath' from this path.
 */
export function readTsconfig(tsconfigPath: string, workspaceRoot?: string): ParsedConfiguration {
  const tsConfigFullPath = workspaceRoot
    ? path.resolve(workspaceRoot, tsconfigPath)
    : tsconfigPath;

  // We use 'ng' instead of 'ts' here because 'ts' is not aware of 'angularCompilerOptions'
  // and will not merged them if they are at un upper level tsconfig file when using `extends`.
  const ng: typeof import('@angular/compiler-cli') = require('@angular/compiler-cli');

  const configResult = ng.readConfiguration(tsConfigFullPath);
  if (configResult.errors && configResult.errors.length) {
    throw new Error(ng.formatDiagnostics(configResult.errors));
  }

  return configResult;
}
