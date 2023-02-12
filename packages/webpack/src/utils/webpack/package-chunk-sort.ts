import { ExtraEntryPoint } from '../models';
import { normalizeExtraEntryPoints } from './normalize-entry';

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
    ).map((entry) => entry.bundleName);

    // remove duplicates
    return [...new Set(entryPoints)];
  };

  const entryPoints = [
    'runtime',
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
