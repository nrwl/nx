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
      const { inject = true, ...newEntry } = entry;
      let bundleName;

      if (entry.bundleName) {
        bundleName = entry.bundleName;
      } else {
        bundleName = defaultBundleName;
      }

      normalizedEntry = { ...newEntry, bundleName };
    }

    return normalizedEntry;
  });
}
