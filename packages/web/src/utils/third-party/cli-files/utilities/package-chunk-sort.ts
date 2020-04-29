/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ExtraEntryPoint } from '../../browser/schema';
import { normalizeExtraEntryPoints } from '../models/webpack-configs/utils';

export function generateEntryPoints(appConfig: {
  styles: ExtraEntryPoint[];
  scripts: ExtraEntryPoint[];
}) {
  // Add all styles/scripts, except lazy-loaded ones.
  const extraEntryPoints = (
    extraEntryPoints: ExtraEntryPoint[],
    defaultBundleName: string
  ): string[] => {
    const entryPoints = normalizeExtraEntryPoints(
      extraEntryPoints,
      defaultBundleName
    )
      .filter((entry) => entry.inject)
      .map((entry) => entry.bundleName);

    // remove duplicates
    return [...new Set(entryPoints)];
  };

  const entryPoints = [
    'polyfills-nomodule-es5',
    'runtime',
    'polyfills-es5',
    'polyfills',
    'sw-register',
    ...extraEntryPoints(appConfig.styles, 'styles'),
    ...extraEntryPoints(appConfig.scripts, 'scripts'),
    'vendor',
    'main',
  ];

  const duplicates = [
    ...new Set(
      entryPoints.filter(
        (x) => entryPoints.indexOf(x) !== entryPoints.lastIndexOf(x)
      )
    ),
  ];

  if (duplicates.length > 0) {
    throw new Error(
      `Multiple bundles have been named the same: '${duplicates.join(`', '`)}'.`
    );
  }

  return entryPoints;
}
