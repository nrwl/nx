import { join } from 'node:path';
import type { GlobalEntry } from '../../models';

export function getEntryPoints(
  globalStyles: GlobalEntry[],
  globalScripts: GlobalEntry[],
  isHMREnabled?: boolean
): [name: string, isModule: boolean][] {
  return [
    ['runtime', !isHMREnabled],
    ['polyfills', true],
    ...(globalStyles.filter((s) => s.initial).map((s) => [s.name, false]) as [
      string,
      boolean
    ][]),
    ...(globalScripts.filter((s) => s.initial).map((s) => [s.name, false]) as [
      string,
      boolean
    ][]),
    ['vendor', true],
    ['main', true],
  ];
}

export function getPolyfillsEntry(
  polyfills: string[],
  aot: boolean
): { polyfills?: string[] } {
  const normalizedPolyfills = [...polyfills];
  if (!aot) {
    normalizedPolyfills.push('@angular/compiler');
  }

  if (normalizedPolyfills.length) {
    return { polyfills: normalizedPolyfills };
  }

  return {};
}

export function toRspackEntries(
  entries: GlobalEntry[],
  root: string,
  queryString?: string
) {
  const result: Record<string, { import: string[] }> = {};

  for (const { files, name } of entries) {
    result[name] ??= { import: [] };

    for (const file of files) {
      result[name].import.push(
        join(root, `${file}${queryString ? `?${queryString}` : ''}`)
      );
    }
  }

  return result;
}
