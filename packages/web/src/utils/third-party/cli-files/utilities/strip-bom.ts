/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.

// Strip BOM from file data.
// https://stackoverflow.com/questions/24356713
export function stripBom(data: string) {
  return data.replace(/^\uFEFF/, '');
}
