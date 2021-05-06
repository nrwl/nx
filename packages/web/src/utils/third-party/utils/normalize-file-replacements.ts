/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { normalizePath } from '@nrwl/devkit';
import { join } from 'path';
import { existsSync } from 'fs';
import { FileReplacement } from '../browser/schema';

export class MissingFileReplacementException extends Error {
  constructor(path: String) {
    super(`The ${path} path in file replacements does not exist.`);
  }
}

export interface NormalizedFileReplacement {
  replace: string;
  with: string;
}

export function normalizeFileReplacements(
  fileReplacements: FileReplacement[],
  root: string
): NormalizedFileReplacement[] {
  if (fileReplacements.length === 0) {
    return [];
  }

  const normalizedReplacement = fileReplacements.map((replacement) =>
    normalizeFileReplacement(replacement, root)
  );

  for (const { replace, with: replacementWith } of normalizedReplacement) {
    if (!existsSync(replacementWith)) {
      throw new MissingFileReplacementException(replacementWith);
    }

    if (!existsSync(replace)) {
      throw new MissingFileReplacementException(replace);
    }
  }

  return normalizedReplacement;
}

function normalizeFileReplacement(
  fileReplacement: FileReplacement,
  root?: string
): NormalizedFileReplacement {
  let replacePath: string;
  let withPath: string;
  if (fileReplacement.src && fileReplacement.replaceWith) {
    replacePath = normalizePath(fileReplacement.src);
    withPath = normalizePath(fileReplacement.replaceWith);
  } else if (fileReplacement.replace && fileReplacement.with) {
    replacePath = normalizePath(fileReplacement.replace);
    withPath = normalizePath(fileReplacement.with);
  } else {
    throw new Error(
      `Invalid file replacement: ${JSON.stringify(fileReplacement)}`
    );
  }

  // TODO: For 7.x should this only happen if not absolute?
  if (root) {
    replacePath = join(root, replacePath);
  }
  if (root) {
    withPath = join(root, withPath);
  }

  return { replace: replacePath, with: withPath };
}
