/**
 * Utilities for constructing source map keys used to track the origin
 * of project configuration properties. Source map keys are dot-delimited
 * paths into a ProjectConfiguration, e.g. `targets.build.inputs.0.projects`.
 *
 * Centralizing key construction here prevents typos and ensures consistent
 * key shapes across the project graph build pipeline.
 */

/** Describes the file and plugin that contributed a given configuration property. */
export type SourceInformation = [file: string | null, plugin: string];

/** Maps each project root to a source map for its configuration properties. */
export type ConfigurationSourceMaps = Record<
  string,
  Record<string, SourceInformation>
>;

/**
 * Calls `callback` with the source map key for each index of `array` under
 * `prefixKey`, producing keys like `${prefixKey}.0`, `${prefixKey}.1`, etc.
 *
 * Use this when you need the keys themselves — e.g. to register or clear
 * entries in a name substitution manager — without necessarily writing to a
 * source map.
 *
 * @param prefixKey The dot-delimited path prefix for the array (e.g. `"targets.build.inputs"`).
 * @param array The array whose indices should be iterated.
 * @param callback Called with the key for each index.
 * @param startIndex Index to start from. Useful when appending to an existing array.
 */
export function forEachSourceMapKeyForArray(
  prefixKey: string,
  array: unknown[],
  callback: (key: string, index: number) => void,
  startIndex = 0
): void {
  for (let i = startIndex; i < array.length; i++) {
    callback(`${prefixKey}.${i}`, i);
  }
}

/**
 * Records a single source map entry. Prefer this over direct bracket
 * assignment to keep writes consistent with the rest of the source map API.
 */
export function recordSourceMapInfo(
  sourceMap: Record<string, SourceInformation>,
  key: string,
  sourceInfo: SourceInformation
): void {
  sourceMap[key] = sourceInfo;
}

/**
 * Convenience wrapper that records a source map entry for each index of
 * `array` under `prefixKey`. Equivalent to calling {@link forEachSourceMapKeyForArray}
 * and {@link recordSourceMapInfo} together.
 *
 * @param sourceMap The source map to write into.
 * @param prefixKey The dot-delimited path prefix for the array (e.g. `"targets.build.inputs"`).
 * @param array The array whose indices should be recorded.
 * @param sourceInfo The source information to associate with each index key.
 * @param startIndex Index to start writing from. Useful when appending to an existing array.
 */
export function recordSourceMapKeysByIndex(
  sourceMap: Record<string, SourceInformation>,
  prefixKey: string,
  array: unknown[],
  sourceInfo: SourceInformation,
  startIndex = 0
): void {
  forEachSourceMapKeyForArray(
    prefixKey,
    array,
    (key) => recordSourceMapInfo(sourceMap, key, sourceInfo),
    startIndex
  );
}

/**
 * Builds a source map key for a target entry.
 *
 * @example
 * // Returns "targets.build"
 * targetSourceMapKey('build')
 */
export function targetSourceMapKey(targetName: string): string {
  return `targets.${targetName}`;
}

/**
 * Builds a source map key for a specific option within a target.
 *
 * @example
 * // Returns "targets.build.options.outputPath"
 * targetOptionSourceMapKey('build', 'outputPath')
 */
export function targetOptionSourceMapKey(
  targetName: string,
  optionKey: string
): string {
  return `targets.${targetName}.options.${optionKey}`;
}

/**
 * Builds a source map key for a target's configurations section, optionally
 * scoped to a specific configuration name and key within it.
 *
 * @example
 * targetConfigurationsSourceMapKey('build')                         // "targets.build.configurations"
 * targetConfigurationsSourceMapKey('build', 'production')           // "targets.build.configurations.production"
 * targetConfigurationsSourceMapKey('build', 'production', 'outputHashing') // "targets.build.configurations.production.outputHashing"
 */
export function targetConfigurationsSourceMapKey(
  targetName: string,
  configurationName?: string,
  configurationKey?: string
): string {
  let key = `targets.${targetName}.configurations`;
  if (configurationName) {
    key += `.${configurationName}`;
  }
  if (configurationKey) {
    key += `.${configurationKey}`;
  }
  return key;
}
