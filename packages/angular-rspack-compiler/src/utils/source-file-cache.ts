/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as path from 'node:path';
import type ts from 'typescript';
import { isUsingWindows } from './utils';

const WINDOWS_SEP_REGEXP = new RegExp(`\\${path.win32.sep}`, 'g');

/**
 * Angular compilation output after the JavaScript transformer has run, with
 * any inline sourcemap already split off the code.
 */
export interface TransformedSource {
  code: string;
  map: string | undefined;
}

/**
 * Key used by `typeScriptFileCache`: the normalized path with any Windows
 * drive letter stripped, so emitted filenames and loader resource paths match.
 */
export function toTypeScriptFileCacheKey(file: string): string {
  return path.normalize(file.replace(/^[A-Z]:/, ''));
}

export class SourceFileCache extends Map<string, ts.SourceFile> {
  readonly modifiedFiles = new Set<string>();

  /**
   * Emitted build output keyed by {@link toTypeScriptFileCacheKey}. A `string`
   * entry is the raw, untransformed emit; the loaders replace it in place with
   * a {@link TransformedSource} once the JavaScript transformer has run.
   * Overwriting an entry with a fresh raw emit evicts the stale transform.
   */
  readonly typeScriptFileCache = new Map<string, string | TransformedSource>();

  /**
   * JavaScript transformer output for files outside the Angular compilation
   * (e.g. package code), keyed by {@link toTypeScriptFileCacheKey}. These are
   * never re-emitted, so modifying a file must evict its entry.
   */
  readonly babelFileCache = new Map<string, string>();

  referencedFiles?: readonly string[];

  constructor(readonly persistentCachePath?: string) {
    super();
  }

  invalidate(files: Iterable<string>): void {
    if (files !== this.modifiedFiles) {
      this.modifiedFiles.clear();
    }
    for (let file of files) {
      this.babelFileCache.delete(toTypeScriptFileCacheKey(file));

      file = path.normalize(file);

      // Normalize separators to allow matching TypeScript Host paths
      if (isUsingWindows()) {
        file = file.replace(WINDOWS_SEP_REGEXP, path.posix.sep);
      }

      this.delete(file);
      this.modifiedFiles.add(file);
    }
  }

  /**
   * Drops output cached for files deleted from disk. Modified files don't
   * need this for emitted output: their next emit overwrites the entry.
   */
  prune(removedFiles: Iterable<string>): void {
    for (const file of removedFiles) {
      const key = toTypeScriptFileCacheKey(file);
      this.typeScriptFileCache.delete(key);
      this.babelFileCache.delete(key);
    }
  }
}
