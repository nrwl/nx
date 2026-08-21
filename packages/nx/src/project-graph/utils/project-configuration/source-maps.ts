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
 * Write the source for the target node key (`targets.<name>`). Ownership of a
 * target follows its identity, not the last writer:
 *
 *  - An unowned key goes to whoever writes it first (the creator).
 *  - A target-defaults stamp is weak — it never authors a target's existence,
 *    so any real plugin reclaims the key from it, and it can never take the
 *    key from a real plugin.
 *  - Between real plugins, the key only changes hands when the merge changed
 *    the target's identity (executor/command) — a plugin that merely layers
 *    fields (dependsOn, options, …) onto an existing target does not become
 *    its owner.
 */
export function recordTargetIdentitySourceMapInfo(
  sourceMap: Record<string, SourceInformation>,
  key: string,
  sourceInfo: SourceInformation,
  identityChanged = false
): void {
  const existing = sourceMap[key];
  if (existing === undefined) {
    sourceMap[key] = sourceInfo;
    return;
  }
  if (sourceInfo[1] === TARGET_DEFAULTS_PLUGIN_NAME) {
    return;
  }
  if (existing[1] === TARGET_DEFAULTS_PLUGIN_NAME || identityChanged) {
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
