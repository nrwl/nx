/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { forEach, FileEntry, Rule } from '@angular-devkit/schematics';

export const enum MatchWith {
  FULL = '[Remove] Full Match',
  STARTS = '[Remove] Starts With',
  ENDS = '[Remove] Ends With',
  CONTAINS = '[Remove] Contains'
}

// @Todo - Remove once https://github.com/angular/devkit/pull/599 is merged
export function remove(
  criteria: string,
  matchBy: MatchWith = MatchWith.FULL
): Rule {
  return forEach((entry: FileEntry): FileEntry | null => {
    switch (matchBy) {
      case MatchWith.FULL:
        return entry.path === criteria ? null : entry;
      case MatchWith.STARTS:
        return entry.path.startsWith(criteria) ? null : entry;
      case MatchWith.CONTAINS:
        return entry.path.indexOf(criteria) > -1 ? null : entry;
      case MatchWith.ENDS:
        return entry.path.endsWith(criteria) ? null : entry;
    }
    return entry;
  });
}
