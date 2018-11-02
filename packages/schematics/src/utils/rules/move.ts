/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

/**
 * This is temporarily copied from `@angular/cli` with a performance fix.
 * Remove when this PR ships: https://github.com/angular/angular-cli/pull/12857
 */

import { normalize } from '@angular-devkit/core';
import { noop, Rule } from '@angular-devkit/schematics';

export function move(from: string, to?: string): Rule {
  if (to === undefined) {
    to = from;
    from = '/';
  }

  const fromPath = normalize('/' + from);
  const toPath = normalize('/' + to);

  if (fromPath === toPath) {
    return noop();
  }

  return tree => {
    if (tree.exists(fromPath)) {
      // fromPath is a file
      tree.rename(fromPath, toPath);
    } else {
      // fromPath is a directory
      tree.getDir(fromPath).visit(path => {
        tree.rename(path, toPath + '/' + path.substr(fromPath.length));
      });
    }

    return tree;
  };
}
