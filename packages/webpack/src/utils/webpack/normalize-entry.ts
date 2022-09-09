import { basename } from 'path';
import { normalizePath } from '@nrwl/devkit';

import { ExtraEntryPoint, NormalizedEntryPoint } from '../models';

export function normalizeExtraEntryPoints(
  extraEntryPoints: ExtraEntryPoint[],
  defaultBundleName: string
): NormalizedEntryPoint[] {
  return extraEntryPoints.map((entry) => {
    let normalizedEntry;
    if (typeof entry === 'string') {
      normalizedEntry = {
        input: entry,
        inject: true,
        bundleName: defaultBundleName,
      };
    } else {
      const { lazy, inject = true, ...newEntry } = entry;
      const injectNormalized = entry.lazy !== undefined ? !entry.lazy : inject;
      let bundleName;

      if (entry.bundleName) {
        bundleName = entry.bundleName;
      } else if (!injectNormalized) {
        // Lazy entry points use the file name as bundle name.
        bundleName = basename(
          normalizePath(
            entry.input.replace(/\.(js|css|scss|sass|less|styl)$/i, '')
          )
        );
      } else {
        bundleName = defaultBundleName;
      }

      normalizedEntry = { ...newEntry, inject: injectNormalized, bundleName };
    }

    return normalizedEntry;
  });
}
