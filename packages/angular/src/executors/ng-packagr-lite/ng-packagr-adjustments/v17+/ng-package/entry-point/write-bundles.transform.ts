/**
 * Adapted from the original ng-packagr.
 *
 * Changes made:
 * - Removed bundling altogether.
 */

import { transformFromPromise } from 'ng-packagr/lib/graph/transform';
import type { NgPackagrOptions } from 'ng-packagr';

export const writeBundlesTransform = (_options: NgPackagrOptions) =>
  transformFromPromise(async (graph) => graph);
