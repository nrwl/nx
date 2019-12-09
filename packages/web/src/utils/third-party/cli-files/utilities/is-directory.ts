/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.

import * as fs from 'fs';

export function isDirectory(path: string) {
  try {
    return fs.statSync(path).isDirectory();
  } catch (_) {
    return false;
  }
}
