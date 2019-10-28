/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const mangleVariable = process.env['NG_BUILD_MANGLE'];
export const manglingDisabled =
  !!mangleVariable && (mangleVariable === '0' || mangleVariable.toLowerCase() === 'false');
