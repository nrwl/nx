/**
 * Adapted from the original ng-packagr.
 *
 * Changes made:
 * - Removed bundling altogether.
 */

import { transformFromPromise } from 'ng-packagr/lib/graph/transform';
import { NgPackagrOptions } from 'ng-packagr/lib/ng-package/options.di';

export const writeBundlesTransform = (_options: NgPackagrOptions) =>
  transformFromPromise(async (graph) => graph);
