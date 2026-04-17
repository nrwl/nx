import { NX_PREFIX } from '../../../utils/logger';
import {
  ProjectConfiguration,
  ProjectMetadata,
  TargetConfiguration,
  TargetMetadata,
} from '../../../config/workspace-json-project-json';
import { recordSourceMapKeysByIndex } from './source-maps';

import type { SourceInformation } from './source-maps';
import {
  getMergeValueResult,
  INTEGER_LIKE_KEY_PATTERN,
  NX_SPREAD_TOKEN,
  throwIntegerLikeSpreadKey,
  uniqueKeysInObjects,
} from './utils';

export function deepClone<T>(obj: T): T {
  return structuredClone(obj);
}

export function resolveCommandSyntacticSugar(
  target: TargetConfiguration,
  key: string
): TargetConfiguration {
  const { command, ...config } = target ?? {};

  if (!command) {
    return target;
  }

  if (config.executor) {
    throw new Error(
      `${NX_PREFIX} Project at ${key} should not have executor and command both configured.`
    );
  } else {
    return {
      ...config,
      executor: 'nx:run-commands',
      options: {
        ...config.options,
        command: command,
      },
    };
  }
}

export function mergeMetadata<T = ProjectMetadata | TargetMetadata>(
  sourceMap: Record<string, [file: string, plugin: string]>,
  sourceInformation: [file: string, plugin: string],
  baseSourceMapPath: string,
  metadata: T,
  matchingMetadata?: T
): T {
  const result: T = {
    ...(matchingMetadata ?? ({} as T)),
  };
  for (const [metadataKey, value] of Object.entries(metadata)) {
    const existingValue = matchingMetadata?.[metadataKey];

    if (Array.isArray(value) && Array.isArray(existingValue)) {
      const startIndex = result[metadataKey].length;
      result[metadataKey].push(...value);
      if (sourceMap) {
        recordSourceMapKeysByIndex(
          sourceMap,
          `${baseSourceMapPath}.${metadataKey}`,
          result[metadataKey],
          sourceInformation,
          startIndex
        );
      }
    } else if (Array.isArray(value) && existingValue === undefined) {
      result[metadataKey] ??= value;
      if (sourceMap) {
        sourceMap[`${baseSourceMapPath}.${metadataKey}`] = sourceInformation;
        recordSourceMapKeysByIndex(
          sourceMap,
          `${baseSourceMapPath}.${metadataKey}`,
          value,
          sourceInformation
        );
      }
    } else if (typeof value === 'object' && typeof existingValue === 'object') {
      for (const key in value) {
        const existingValue = matchingMetadata?.[metadataKey]?.[key];

        if (Array.isArray(value[key]) && Array.isArray(existingValue)) {
          const startIndex = result[metadataKey][key].length;
          result[metadataKey][key].push(...value[key]);
          if (sourceMap) {
            recordSourceMapKeysByIndex(
              sourceMap,
              `${baseSourceMapPath}.${metadataKey}.${key}`,
              result[metadataKey][key],
              sourceInformation,
              startIndex
            );
          }
        } else {
          result[metadataKey][key] = value[key];
          if (sourceMap) {
            sourceMap[`${baseSourceMapPath}.${metadataKey}`] =
              sourceInformation;
          }
        }
      }
    } else {
      result[metadataKey] = value;
      if (sourceMap) {
        sourceMap[`${baseSourceMapPath}.${metadataKey}`] = sourceInformation;

        if (typeof value === 'object') {
          for (const k in value) {
            sourceMap[`${baseSourceMapPath}.${metadataKey}.${k}`] =
              sourceInformation;
            if (Array.isArray(value[k])) {
              recordSourceMapKeysByIndex(
                sourceMap,
                `${baseSourceMapPath}.${metadataKey}.${k}`,
                value[k],
                sourceInformation
              );
            }
          }
        }
      }
    }
  }
  return result;
}

function mergeOptions(
  newOptions: Record<string, any> | undefined,
  baseOptions: Record<string, any> | undefined,
  projectConfigSourceMap?: Record<string, SourceInformation>,
  sourceInformation?: SourceInformation,
  targetIdentifier?: string,
  deferSpreadsWithoutBase?: boolean
): Record<string, any> | undefined {
  // `'...'` at the options level uses object-spread semantics.
  if (newOptions?.[NX_SPREAD_TOKEN] === true) {
    return getMergeValueResult(
      baseOptions,
      newOptions,
      projectConfigSourceMap
        ? {
            sourceMap: projectConfigSourceMap,
            key: `${targetIdentifier}.options`,
            sourceInformation,
          }
        : undefined,
      deferSpreadsWithoutBase
    ) as Record<string, any>;
  }

  const mergedOptionKeys = uniqueKeysInObjects(
    baseOptions ?? {},
    newOptions ?? {}
  );
  const mergedOptions = {};

  for (const optionKey of mergedOptionKeys) {
    mergedOptions[optionKey] = getMergeValueResult(
      baseOptions ? baseOptions[optionKey] : undefined,
      newOptions ? newOptions[optionKey] : undefined,
      projectConfigSourceMap
        ? {
            sourceMap: projectConfigSourceMap,
            key: `${targetIdentifier}.options.${optionKey}`,
            sourceInformation,
          }
        : undefined,
      deferSpreadsWithoutBase
    );
  }

  return mergedOptions;
}

// Merges a single named configuration, keyed under its own identifier
// (e.g. `targets.build.configurations.prod`) rather than under `.options`.
function mergeConfigurationValue(
  newConfig: Record<string, any> | undefined,
  baseConfig: Record<string, any> | undefined,
  projectConfigSourceMap?: Record<string, SourceInformation>,
  sourceInformation?: SourceInformation,
  configIdentifier?: string,
  deferSpreadsWithoutBase?: boolean
): Record<string, any> | undefined {
  if (newConfig?.[NX_SPREAD_TOKEN] === true) {
    // Snapshot base per-key sources: getMergeValueResult iterates new keys
    // in order and writes the new source for pre-`'...'` keys, which would
    // clobber the base entries it then reads during spread expansion.
    // Re-apply base attribution afterward for shared keys that yielded.
    const baseSourcesForSharedKeys =
      projectConfigSourceMap && configIdentifier && baseConfig
        ? captureBasePerKeySources(
            projectConfigSourceMap,
            configIdentifier,
            baseConfig,
            newConfig
          )
        : undefined;

    const result = getMergeValueResult(
      baseConfig,
      newConfig,
      projectConfigSourceMap && configIdentifier
        ? {
            sourceMap: projectConfigSourceMap,
            key: configIdentifier,
            sourceInformation,
          }
        : undefined,
      deferSpreadsWithoutBase
    ) as Record<string, any>;

    if (
      baseSourcesForSharedKeys &&
      projectConfigSourceMap &&
      configIdentifier
    ) {
      for (const sharedKey in baseSourcesForSharedKeys) {
        // Only restore attribution when the base value actually won
        // (key was before `'...'`). If new won, keep its fresh source.
        if (
          result &&
          Object.prototype.hasOwnProperty.call(result, sharedKey) &&
          result[sharedKey] === baseConfig[sharedKey]
        ) {
          projectConfigSourceMap[`${configIdentifier}.${sharedKey}`] =
            baseSourcesForSharedKeys[sharedKey];
        }
      }
    }

    return result;
  }

  const mergedKeys = uniqueKeysInObjects(baseConfig ?? {}, newConfig ?? {});
  const merged: Record<string, any> = {};

  for (const key of mergedKeys) {
    merged[key] = getMergeValueResult(
      baseConfig ? baseConfig[key] : undefined,
      newConfig ? newConfig[key] : undefined,
      projectConfigSourceMap && configIdentifier
        ? {
            sourceMap: projectConfigSourceMap,
            key: `${configIdentifier}.${key}`,
            sourceInformation,
          }
        : undefined,
      deferSpreadsWithoutBase
    );
  }

  return merged;
}

// Reads per-key source attribution for keys shared between base and new.
function captureBasePerKeySources(
  sourceMap: Record<string, SourceInformation>,
  configIdentifier: string,
  baseConfig: Record<string, any>,
  newConfig: Record<string, any> | undefined
): Record<string, SourceInformation> {
  const captured: Record<string, SourceInformation> = {};
  for (const key of Object.keys(baseConfig)) {
    if (!newConfig || !(key in newConfig)) continue;
    const existing = sourceMap[`${configIdentifier}.${key}`];
    if (existing) {
      captured[key] = existing;
    }
  }
  return captured;
}

function mergeConfigurations<T extends Object>(
  newConfigurations: Record<string, T> | undefined,
  baseConfigurations: Record<string, T> | undefined,
  projectConfigSourceMap?: Record<string, SourceInformation>,
  sourceInformation?: SourceInformation,
  targetIdentifier?: string,
  deferSpreadsWithoutBase?: boolean
): Record<string, T> | undefined {
  const mergedConfigurations: Record<string, T> = {};

  const configNames = uniqueKeysInObjects(
    baseConfigurations ?? {},
    newConfigurations ?? {}
  );

  // Keys before '...' let base win for shared names; keys after '...'
  // (or when there's no spread) merge normally with new winning.
  const newKeys = Object.keys(newConfigurations ?? {});
  const spreadPosInNew = newKeys.indexOf(NX_SPREAD_TOKEN);
  const hasSpread = spreadPosInNew >= 0;
  const keysBeforeSpread = hasSpread
    ? new Set(newKeys.slice(0, spreadPosInNew))
    : new Set<string>();

  // Integer-like keys get hoisted to newKeys[0], making their position
  // relative to '...' unrecoverable.
  if (hasSpread && newKeys[0] && INTEGER_LIKE_KEY_PATTERN.test(newKeys[0])) {
    throwIntegerLikeSpreadKey(
      newKeys[0],
      targetIdentifier
        ? `Configurations at "${targetIdentifier}.configurations"`
        : 'Configurations'
    );
  }

  for (const configName of configNames) {
    if (configName === NX_SPREAD_TOKEN) continue;

    const configIdentifier = targetIdentifier
      ? `${targetIdentifier}.configurations.${configName}`
      : undefined;
    const baseHasConfig = configName in (baseConfigurations ?? {});
    const newHasConfig = !!newConfigurations && configName in newConfigurations;

    if (hasSpread && keysBeforeSpread.has(configName)) {
      // Before '...': base wins for shared names. Keep base's source-map
      // entries when it owns the config.
      if (baseHasConfig) {
        mergedConfigurations[configName] = baseConfigurations[configName];
      } else {
        mergedConfigurations[configName] = mergeConfigurationValue(
          newConfigurations?.[configName],
          undefined,
          projectConfigSourceMap,
          sourceInformation,
          configIdentifier,
          deferSpreadsWithoutBase
        ) as T;
        if (projectConfigSourceMap && configIdentifier) {
          projectConfigSourceMap[configIdentifier] = sourceInformation;
        }
      }
    } else {
      mergedConfigurations[configName] = mergeConfigurationValue(
        newConfigurations?.[configName],
        baseConfigurations?.[configName],
        projectConfigSourceMap,
        sourceInformation,
        configIdentifier,
        deferSpreadsWithoutBase
      ) as T;
      // Only reattribute the config name when the new plugin introduced it.
      if (
        projectConfigSourceMap &&
        configIdentifier &&
        newHasConfig &&
        !baseHasConfig
      ) {
        projectConfigSourceMap[configIdentifier] = sourceInformation;
      }
    }
  }

  if (
    hasSpread &&
    deferSpreadsWithoutBase &&
    baseConfigurations === undefined
  ) {
    // See mergeTargetConfigurations — '...' must stay at its authored
    // index for pass 2 to classify siblings correctly.
    reorderToMatchAuthoredKeys(
      mergedConfigurations as unknown as Record<string, unknown>,
      newKeys
    );
  }

  return mergedConfigurations;
}

// Reorders `result`'s own-keys to match `authoredKeys`, placing '...' at
// its authored index. Needed because pass 2 uses key-iteration order to
// classify before/after-spread; appending '...' at the end would flip it.
// Keys not in `authoredKeys` are appended last (their position doesn't
// affect classification). `skipKeys` are handled elsewhere.
function reorderToMatchAuthoredKeys(
  result: Record<string, unknown>,
  authoredKeys: string[],
  skipKeys?: Set<string>
): void {
  const ordered: Record<string, unknown> = {};
  for (const key of authoredKeys) {
    if (key === NX_SPREAD_TOKEN) {
      ordered[NX_SPREAD_TOKEN] = true;
    } else if ((!skipKeys || !skipKeys.has(key)) && key in result) {
      ordered[key] = result[key];
    }
  }
  for (const key of Object.keys(result)) {
    if (!(key in ordered)) {
      ordered[key] = result[key];
    }
  }
  for (const key of Object.keys(result)) {
    delete result[key];
  }
  Object.assign(result, ordered);
}

/**
 * Merges two targets.
 *
 * Most properties from `target` will overwrite any properties from `baseTarget`.
 * Options and configurations are treated differently - they are merged together if the executor definition is compatible.
 *
 * @param target The target definition with higher priority
 * @param baseTarget The target definition that should be overwritten. Can be undefined, in which case the target is returned as-is.
 * @param projectConfigSourceMap The source map to be filled with metadata about where each property came from
 * @param sourceInformation The metadata about where the new target was defined
 * @param targetIdentifier The identifier for the target to merge, used for source map
 * @returns A merged target configuration
 */
export function mergeTargetConfigurations(
  target: TargetConfiguration,
  baseTarget?: TargetConfiguration,
  projectConfigSourceMap?: Record<string, SourceInformation>,
  sourceInformation?: SourceInformation,
  targetIdentifier?: string,
  deferSpreadsWithoutBase?: boolean
): TargetConfiguration {
  const {
    configurations: defaultConfigurations,
    options: defaultOptions,
    ...baseTargetProperties
  } = baseTarget ?? {};

  // Target is "compatible", e.g. executor is defined only once or is the same
  // in both places. This means that it is likely safe to merge
  const isCompatible = isCompatibleTarget(baseTarget ?? {}, target);

  if (!isCompatible && projectConfigSourceMap) {
    // if the target is not compatible, we will simply override the options
    // we have to delete old entries from the source map
    for (const key in projectConfigSourceMap) {
      if (key.startsWith(`${targetIdentifier}`)) {
        delete projectConfigSourceMap[key];
      }
    }
  }

  // merge top level properties if they're compatible
  const result: Partial<TargetConfiguration> = {};
  const mergeBase = isCompatible ? baseTargetProperties : {};

  const keys: Iterable<string> = isCompatible
    ? uniqueKeysInObjects(baseTargetProperties, target)
    : Object.keys(target);

  // Keys before '...' let base win; keys after '...' (or when there's no
  // spread) merge normally with target winning.
  const targetKeys = Object.keys(target);
  const spreadPosInTarget = targetKeys.indexOf(NX_SPREAD_TOKEN);
  const hasSpread = isCompatible && spreadPosInTarget >= 0;
  const keysBeforeSpread = hasSpread
    ? new Set(targetKeys.slice(0, spreadPosInTarget))
    : new Set<string>();

  // Integer-like keys get hoisted to targetKeys[0], making their position
  // relative to '...' unrecoverable.
  if (
    hasSpread &&
    targetKeys[0] &&
    INTEGER_LIKE_KEY_PATTERN.test(targetKeys[0])
  ) {
    throwIntegerLikeSpreadKey(
      targetKeys[0],
      targetIdentifier ? `Target at "${targetIdentifier}"` : 'Target'
    );
  }

  for (const key of keys) {
    // options and configurations have their own merge logic below
    if (
      key === 'options' ||
      key === 'configurations' ||
      key === NX_SPREAD_TOKEN
    ) {
      continue;
    }

    if (hasSpread && keysBeforeSpread.has(key)) {
      // Before '...': base wins; fall through to target only if base lacks it.
      result[key] =
        key in mergeBase
          ? mergeBase[key]
          : getMergeValueResult(
              undefined,
              target[key],
              projectConfigSourceMap
                ? {
                    sourceMap: projectConfigSourceMap,
                    key: `${targetIdentifier}.${key}`,
                    sourceInformation,
                  }
                : undefined,
              deferSpreadsWithoutBase
            );
    } else if (key in target) {
      result[key] = getMergeValueResult(
        mergeBase[key],
        target[key],
        projectConfigSourceMap
          ? {
              sourceMap: projectConfigSourceMap,
              key: `${targetIdentifier}.${key}`,
              sourceInformation,
            }
          : undefined,
        deferSpreadsWithoutBase
      );
    } else {
      result[key] = mergeBase[key];
    }
  }

  if (
    spreadPosInTarget >= 0 &&
    deferSpreadsWithoutBase &&
    baseTarget === undefined
  ) {
    // '...' must stay at its authored index so pass 2's before/after-spread
    // classification matches what the user wrote.
    reorderToMatchAuthoredKeys(
      result as Record<string, unknown>,
      targetKeys,
      new Set(['options', 'configurations'])
    );
  }

  // Update source map once after loop
  if (projectConfigSourceMap) {
    projectConfigSourceMap[targetIdentifier] = sourceInformation;
  }

  // merge options if there are any
  // if the targets aren't compatible, we simply discard the old options during the merge
  if (target.options || defaultOptions) {
    result.options = mergeOptions(
      target.options,
      isCompatible ? defaultOptions : undefined,
      projectConfigSourceMap,
      sourceInformation,
      targetIdentifier,
      deferSpreadsWithoutBase
    );
    if (projectConfigSourceMap && target.options) {
      projectConfigSourceMap[`${targetIdentifier}.options`] = sourceInformation;
    }
  }

  // merge configurations if there are any
  // if the targets aren't compatible, we simply discard the old configurations during the merge
  if (target.configurations || defaultConfigurations) {
    result.configurations = mergeConfigurations(
      target.configurations,
      isCompatible ? defaultConfigurations : undefined,
      projectConfigSourceMap,
      sourceInformation,
      targetIdentifier,
      deferSpreadsWithoutBase
    );
    if (projectConfigSourceMap && target.configurations) {
      projectConfigSourceMap[`${targetIdentifier}.configurations`] =
        sourceInformation;
    }
  }

  if (target.metadata) {
    result.metadata = mergeMetadata(
      projectConfigSourceMap,
      sourceInformation,
      `${targetIdentifier}.metadata`,
      target.metadata,
      baseTarget?.metadata
    );
  }

  return result as TargetConfiguration;
}

/**
 * Checks if targets options are compatible - used when merging configurations
 * to avoid merging options for @nx/js:tsc into something like @nx/webpack:webpack.
 *
 * If the executors are both specified and don't match, the options aren't considered
 * "compatible" and shouldn't be merged.
 */
export function isCompatibleTarget(
  a: TargetConfiguration,
  b: TargetConfiguration
) {
  const oneHasNoExecutor = !a.executor || !b.executor;
  const bothHaveSameExecutor = a.executor === b.executor;

  if (oneHasNoExecutor) return true;
  if (!bothHaveSameExecutor) return false;

  const isRunCommands = a.executor === 'nx:run-commands';
  if (isRunCommands) {
    const aCommand = a.options?.command ?? a.options?.commands?.join(' && ');
    const bCommand = b.options?.command ?? b.options?.commands?.join(' && ');

    const oneHasNoCommand = !aCommand || !bCommand;
    const hasSameCommand = aCommand === bCommand;

    return oneHasNoCommand || hasSameCommand;
  }

  const isRunScript = a.executor === 'nx:run-script';
  if (isRunScript) {
    const aScript = a.options?.script;
    const bScript = b.options?.script;

    const oneHasNoScript = !aScript || !bScript;
    const hasSameScript = aScript === bScript;

    return oneHasNoScript || hasSameScript;
  }

  return true;
}

export function resolveNxTokensInOptions<T extends Object | Array<unknown>>(
  object: T,
  project: ProjectConfiguration,
  key: string
): T {
  const result: T = Array.isArray(object) ? ([...object] as T) : { ...object };
  for (let [opt, value] of Object.entries(object ?? {})) {
    if (typeof value === 'string') {
      const workspaceRootMatch = /^(\{workspaceRoot\}\/?)/.exec(value);
      if (workspaceRootMatch?.length) {
        value = value.replace(workspaceRootMatch[0], '');
      }
      if (value.includes('{workspaceRoot}')) {
        throw new Error(
          `${NX_PREFIX} The {workspaceRoot} token is only valid at the beginning of an option. (${key})`
        );
      }
      value = value.replace(/\{projectRoot\}/g, project.root);
      result[opt] = value.replace(/\{projectName\}/g, project.name);
    } else if (typeof value === 'object' && value) {
      result[opt] = resolveNxTokensInOptions(
        value,
        project,
        [key, opt].join('.')
      );
    }
  }
  return result;
}
