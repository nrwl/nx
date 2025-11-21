/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

export function urlJoin(...parts: string[]): string {
  const [p, ...rest] = parts;

  // Remove trailing slash from first part
  // Join all parts with `/`
  // Dedupe double slashes from path names
  return p.replace(/\/$/, '') + ('/' + rest.join('/')).replace(/\/\/+/g, '/');
}
