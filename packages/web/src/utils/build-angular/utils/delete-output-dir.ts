/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Path, resolve, virtualFs } from '@angular-devkit/core';
import { EMPTY } from 'rxjs';
import { concatMap, last } from 'rxjs/operators';

/**
 * Delete an output directory, but error out if it's the root of the project.
 */
export function deleteOutputDir(root: Path, outputPath: Path, host: virtualFs.Host) {
  const resolvedOutputPath = resolve(root, outputPath);
  if (resolvedOutputPath === root) {
    throw new Error('Output path MUST not be project root directory!');
  }

  return host.exists(resolvedOutputPath).pipe(
    concatMap(exists => exists ? host.delete(resolvedOutputPath) : EMPTY),
    last(null, null),
  );
}
