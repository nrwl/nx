import { NX_PREFIX } from '../../../utils/logger';
import { isGlobPattern } from '../../../utils/globs';
import {
  ProjectConfiguration,
  ProjectMetadata,
  TargetConfiguration,
  TargetMetadata,
} from '../../../config/workspace-json-project-json';
import { TargetDefaults } from '../../../config/nx-json';
import {
  recordSourceMapKeysByIndex,
  targetConfigurationsSourceMapKey,
  targetOptionSourceMapKey,
} from './source-maps';

import type { SourceInformation } from './source-maps';
import {
  getMergeValueResult,
  uniqueKeysInObjects,
} from '../project-configuration-utils/utils';

import { minimatch } from 'minimatch';

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
  targetIdentifier?: string
): Record<string, any> | undefined {
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
        : undefined
    );
  }

  return mergedOptions;
}

function mergeConfigurations<T extends Object>(
  newConfigurations: Record<string, T> | undefined,
  baseConfigurations: Record<string, T> | undefined,
  projectConfigSourceMap?: Record<string, SourceInformation>,
  sourceInformation?: SourceInformation,
  targetIdentifier?: string
): Record<string, T> | undefined {
  const mergedConfigurations = {};

  const configurations = uniqueKeysInObjects(
    baseConfigurations ?? {},
    newConfigurations ?? {}
  );
  for (const configuration of configurations) {
    // Intentionally doesn't pass source map, as that is handled below
    mergedConfigurations[configuration] = mergeOptions(
      newConfigurations?.[configuration],
      baseConfigurations?.[configuration]
    );
  }

  // record new configurations & configuration properties in source map
  if (projectConfigSourceMap) {
    for (const newConfiguration in newConfigurations) {
      projectConfigSourceMap[
        `${targetIdentifier}.configurations.${newConfiguration}`
      ] = sourceInformation;
      for (const configurationProperty in newConfigurations[newConfiguration]) {
        projectConfigSourceMap[
          `${targetIdentifier}.configurations.${newConfiguration}.${configurationProperty}`
        ] = sourceInformation;
      }
    }
  }

  return mergedConfigurations;
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
  targetIdentifier?: string
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

  const keys = isCompatible
    ? uniqueKeysInObjects(baseTargetProperties, target)
    : Object.keys(target);

  for (const key of keys) {
    // options and configurations have their own merge logic below
    if (key === 'options' || key === 'configurations') {
      continue;
    }

    if (key in target) {
      result[key] = getMergeValueResult(
        mergeBase[key],
        target[key],
        projectConfigSourceMap
          ? {
              sourceMap: projectConfigSourceMap,
              key: `${targetIdentifier}.${key}`,
              sourceInformation,
            }
          : undefined
      );
    } else {
      result[key] = mergeBase[key];
    }
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
      targetIdentifier
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
      targetIdentifier
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

/**
 * Checks whether the source map entry for a given key comes from an Nx core
 * plugin (one whose name starts with 'nx/'). Returns true when the property
 * was defined by a core plugin, meaning the target definition takes precedence
 * over target defaults.
 *
 * Returns false when there is no source info or the source is a non-core plugin,
 * meaning target defaults should override.
 */
function definedSourceInfoComesFromCorePlugins(
  key: string,
  sourceMap: Record<string, SourceInformation>
) {
  const sourceInfo = sourceMap[key];
  if (!sourceInfo) {
    return false;
  }
  const [, plugin] = sourceInfo;
  return plugin?.startsWith('nx/');
}

function mergeOptionsBasedOnSource(
  optionsFromTargetDefinition: Record<string, any>,
  optionsFromTargetDefaults: Record<string, any>,
  sourceMapKeyBase: string,
  sourceMap: Record<string, SourceInformation>
) {
  const result = {
    ...optionsFromTargetDefinition,
  };
  for (const optionKey in optionsFromTargetDefaults) {
    const sourceMapKey = `${sourceMapKeyBase}.${optionKey}`;
    if (!definedSourceInfoComesFromCorePlugins(sourceMapKey, sourceMap)) {
      // Property was defined by a non-core plugin, so target defaults take precedence
      result[optionKey] = getMergeValueResult(
        optionsFromTargetDefinition[optionKey], // base
        optionsFromTargetDefaults[optionKey], // overrides
        {
          sourceMap,
          key: sourceMapKey,
          sourceInformation: ['nx.json', 'nx/target-defaults'],
        }
      );
    } else {
      // target definition (from core plugin) takes precedence over target defaults
      // Don't pass source map context - keep the original source from core plugin
      result[optionKey] = getMergeValueResult(
        optionsFromTargetDefaults[optionKey], // base
        optionsFromTargetDefinition[optionKey] // overrides
      );
    }
  }
  return result;
}

/**
 * Merges a given target default with a target definition inside a project configuration.
 *
 * NOTE: Target defaults are applied differently based on where the target definition came from.
 * If the target definition was defined by a plugin outside of Nx core plugins, the target default
 * is always applied on top of it. If the target definition was defined by Nx core plugins, the definition
 * takes precedence and target defaults are only applied for properties that are not defined in the target definition.
 *
 * @param targetName The name of the target
 * @param project  The project configuration
 * @param targetDefault The target default to merge with the target definition
 * @param sourceMap Source map info to track where properties came from
 * @returns The merged target configuration
 */
export function mergeTargetDefaultWithTargetDefinition(
  targetName: string,
  project: ProjectConfiguration,
  targetDefault: Partial<TargetConfiguration>,
  sourceMap: Record<string, SourceInformation>
): TargetConfiguration {
  const targetDefinition = project.targets[targetName] ?? {};
  const result = deepClone(targetDefinition);

  for (const key in targetDefault) {
    switch (key) {
      case 'options': {
        const normalizedDefaults = resolveNxTokensInOptions(
          targetDefault.options,
          project,
          targetName
        );
        result.options = mergeOptionsBasedOnSource(
          targetDefinition.options ?? {},
          normalizedDefaults,
          `targets.${targetName}.options`,
          sourceMap
        );
        break;
      }
      case 'configurations': {
        if (!result.configurations) {
          result.configurations = {};
          sourceMap[targetConfigurationsSourceMapKey(targetName)] = [
            'nx.json',
            'nx/target-defaults',
          ];
        }
        for (const configuration in targetDefault.configurations) {
          // easy case, target defaults is adding a new configuration, nothing to merge.
          if (!result.configurations[configuration]) {
            result.configurations[configuration] = {};
            sourceMap[
              targetConfigurationsSourceMapKey(targetName, configuration)
            ] = ['nx.json', 'nx/target-defaults'];
          }
          // must merge...
          // Configurations are very similar to options above in how we merge them, just a layer deeper.
          const configurationTargetDefaults = resolveNxTokensInOptions(
            targetDefault.configurations[configuration],
            project,
            targetName
          );
          result.configurations[configuration] = mergeOptionsBasedOnSource(
            targetDefinition.configurations?.[configuration] ?? {},
            configurationTargetDefaults,
            `targets.${targetName}.configurations.${configuration}`,
            sourceMap
          );
        }
        break;
      }
      default: {
        const sourceMapKey = `targets.${targetName}.${key}`;
        if (
          targetDefinition[key] === undefined ||
          !definedSourceInfoComesFromCorePlugins(sourceMapKey, sourceMap)
        ) {
          result[key] = getMergeValueResult(
            targetDefinition[key],
            targetDefault[key],
            {
              sourceMap,
              key: sourceMapKey,
              sourceInformation: ['nx.json', 'nx/target-defaults'],
            }
          );
        }
        break;
      }
    }
  }
  return result;
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

export function readTargetDefaultsForTarget(
  targetName: string,
  targetDefaults: TargetDefaults,
  executor?: string
): TargetDefaults[string] {
  if (executor && targetDefaults?.[executor]) {
    // If an executor is defined in project.json, defaults should be read
    // from the most specific key that matches that executor.
    // e.g. If executor === run-commands, and the target is named build:
    // Use, use nx:run-commands if it is present
    // If not, use build if it is present.
    return targetDefaults?.[executor];
  } else if (targetDefaults?.[targetName]) {
    // If the executor is not defined, the only key we have is the target name.
    return targetDefaults?.[targetName];
  }

  let matchingTargetDefaultKey: string | null = null;
  for (const key in targetDefaults ?? {}) {
    if (isGlobPattern(key) && minimatch(targetName, key)) {
      if (
        !matchingTargetDefaultKey ||
        matchingTargetDefaultKey.length < key.length
      ) {
        matchingTargetDefaultKey = key;
      }
    }
  }
  if (matchingTargetDefaultKey) {
    return targetDefaults[matchingTargetDefaultKey];
  }

  return null;
}
