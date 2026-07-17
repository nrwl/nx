// Source map keys are dot-delimited paths into a ProjectConfiguration,
// e.g. `targets.build.inputs.0.projects`.

/** [file, plugin] that contributed a configuration property. */
export type SourceInformation = [file: string | null, plugin: string];

/**
 * The synthetic plugin name target-defaults results are attributed to. Shared
 * so the merge can recognize a target-defaults stamp when reconciling
 * provenance — target defaults never genuinely author a target's existence or
 * its executor/command, so such a stamp must not overwrite a real plugin's
 * attribution for those keys.
 */
export const TARGET_DEFAULTS_PLUGIN_NAME = 'nx/target-defaults';

/**
 * Write the source for a target's "identity" key (the target node itself, or
 * its executor/command). Real plugins win last; a target-defaults stamp only
 * claims the key when no real plugin already recorded it — target defaults
 * never bring a target into existence, they only layer fields onto one.
 */
export function recordTargetIdentitySourceMapInfo(
  sourceMap: Record<string, SourceInformation>,
  key: string,
  sourceInfo: SourceInformation
): void {
  if (
    sourceInfo[1] !== TARGET_DEFAULTS_PLUGIN_NAME ||
    sourceMap[key] === undefined
  ) {
    sourceMap[key] = sourceInfo;
  }
}

/** Source map per project root. */
export type ConfigurationSourceMaps = Record<
  string,
  Record<string, SourceInformation>
>;

// Iterates `${prefixKey}.0`, `${prefixKey}.1`, ... for each index of `array`.
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

// Reads per-index source info, falling back to the array's top-level entry.
export function readArrayItemSourceInfo(
  sourceMap: Record<string, SourceInformation>,
  arrayKey: string,
  itemIndex: number
): SourceInformation | undefined {
  return sourceMap[`${arrayKey}.${itemIndex}`] ?? sourceMap[arrayKey];
}

// Reads per-property source info, falling back to the object's top-level entry.
export function readObjectPropertySourceInfo(
  sourceMap: Record<string, SourceInformation>,
  objectKey: string,
  propertyKey: string
): SourceInformation | undefined {
  return sourceMap[`${objectKey}.${propertyKey}`] ?? sourceMap[objectKey];
}

export function recordSourceMapInfo(
  sourceMap: Record<string, SourceInformation>,
  key: string,
  sourceInfo: SourceInformation
): void {
  sourceMap[key] = sourceInfo;
}

// Records the same source info under every `${prefixKey}.${i}` entry.
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

export function targetSourceMapKey(targetName: string): string {
  return `targets.${targetName}`;
}

export function targetOptionSourceMapKey(
  targetName: string,
  optionKey: string
): string {
  return `targets.${targetName}.options.${optionKey}`;
}

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
