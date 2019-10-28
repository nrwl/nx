/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {
  BaseException,
  Path,
  basename,
  dirname,
  join,
  normalize,
  relative,
  resolve,
  virtualFs,
} from '@angular-devkit/core';
import { AssetPattern, AssetPatternClass } from '../browser/schema';


export class MissingAssetSourceRootException extends BaseException {
  constructor(path: String) {
    super(`The ${path} asset path must start with the project source root.`);
  }
}

export function normalizeAssetPatterns(
  assetPatterns: AssetPattern[],
  host: virtualFs.SyncDelegateHost,
  root: Path,
  projectRoot: Path,
  maybeSourceRoot: Path | undefined,
): AssetPatternClass[] {
  // When sourceRoot is not available, we default to ${projectRoot}/src.
  const sourceRoot = maybeSourceRoot || join(projectRoot, 'src');
  const resolvedSourceRoot = resolve(root, sourceRoot);

  if (assetPatterns.length === 0) {
    return [];
  }

  return assetPatterns
    .map(assetPattern => {
      // Normalize string asset patterns to objects.
      if (typeof assetPattern === 'string') {
        const assetPath = normalize(assetPattern);
        const resolvedAssetPath = resolve(root, assetPath);

        // Check if the string asset is within sourceRoot.
        if (!resolvedAssetPath.startsWith(resolvedSourceRoot)) {
          throw new MissingAssetSourceRootException(assetPattern);
        }

        let glob: string, input: Path, output: Path;
        let isDirectory = false;

        try {
          isDirectory = host.isDirectory(resolvedAssetPath);
        } catch {
          isDirectory = true;
        }

        if (isDirectory) {
          // Folders get a recursive star glob.
          glob = '**/*';
          // Input directory is their original path.
          input = assetPath;
        } else {
          // Files are their own glob.
          glob = basename(assetPath);
          // Input directory is their original dirname.
          input = dirname(assetPath);
        }

        // Output directory for both is the relative path from source root to input.
        output = relative(resolvedSourceRoot, resolve(root, input));

        // Return the asset pattern in object format.
        return { glob, input, output };
      } else {
        // It's already an AssetPatternObject, no need to convert.
        return assetPattern;
      }
    });
}
