/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import { StatsChunk, StatsCompilation } from '@rspack/core';
import { NormalizedEntryPoint } from '../models/angular-rspack-plugin-options';

/**
 * Webpack stats may incorrectly mark extra entry points `initial` chunks, when
 * they are actually loaded asynchronously and thus not in the main bundle. This
 * function finds extra entry points in Webpack stats and corrects this value
 * whereever necessary. Does not modify {@param webpackStats}.
 */
export function markAsyncChunksNonInitial(
  webpackStats: StatsCompilation,
  extraEntryPoints: NormalizedEntryPoint[]
): StatsChunk[] {
  const { chunks = [], entrypoints: entryPoints = {} } = webpackStats;

  // Find all Webpack chunk IDs not injected into the main bundle. We don't have
  // to worry about transitive dependencies because extra entry points cannot be
  // depended upon in Webpack, thus any extra entry point with `inject: false`,
  // **cannot** be loaded in main bundle.
  const asyncChunkIds = extraEntryPoints
    .filter(
      (entryPoint) => !entryPoint.inject && entryPoints[entryPoint.bundleName]
    )
    .flatMap((entryPoint) =>
      entryPoints[entryPoint.bundleName].chunks?.filter((n) => n !== 'runtime')
    );

  // Find chunks for each ID.
  const asyncChunks = asyncChunkIds.map((chunkId) => {
    const chunk = chunks.find((chunk) => chunk.id === chunkId);
    if (!chunk) {
      throw new Error(
        `Failed to find chunk (${chunkId}) in set:\n${JSON.stringify(chunks)}`
      );
    }

    return chunk;
  });

  // A chunk is considered `initial` only if Webpack already belives it to be initial
  // and the application developer did not mark it async via an extra entry point.
  return chunks.map((chunk) => {
    return asyncChunks.find((asyncChunk) => asyncChunk === chunk)
      ? {
          ...chunk,
          initial: false,
        }
      : chunk;
  });
}
