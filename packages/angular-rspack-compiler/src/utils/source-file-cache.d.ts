/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import type ts from 'typescript';
export declare class SourceFileCache extends Map<string, ts.SourceFile> {
  readonly persistentCachePath?: string | undefined;
  readonly modifiedFiles: Set<string>;
  readonly babelFileCache: Map<string, Uint8Array>;
  readonly typeScriptFileCache: Map<string, string | Uint8Array>;
  referencedFiles?: readonly string[];
  constructor(persistentCachePath?: string | undefined);
  invalidate(files: Iterable<string>): void;
}
