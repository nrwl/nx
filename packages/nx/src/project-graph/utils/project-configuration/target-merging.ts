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
  const mergedOptions = {
    ...(baseOptions ?? {}),
    ...(newOptions ?? {}),
  };

  // record new options & option properties in source map
  if (projectConfigSourceMap) {
    for (const newOption in newOptions) {
      projectConfigSourceMap[`${targetIdentifier}.options.${newOption}`] =
        sourceInformation;
    }
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

  const configurations = new Set([
    ...Object.keys(baseConfigurations ?? {}),
    ...Object.keys(newConfigurations ?? {}),
  ]);
  for (const configuration of configurations) {
    mergedConfigurations[configuration] = {
      ...(baseConfigurations?.[configuration] ?? {}),
      ...(newConfigurations?.[configuration] ?? {}),
    };
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
  const result = {
    ...(isCompatible ? baseTargetProperties : {}),
    ...target,
  };

  // record top level properties in source map
  if (projectConfigSourceMap) {
    projectConfigSourceMap[targetIdentifier] = sourceInformation;

    // record root level target properties to source map
    for (const targetProperty in target) {
      const targetPropertyId = `${targetIdentifier}.${targetProperty}`;
      projectConfigSourceMap[targetPropertyId] = sourceInformation;
    }
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

function targetDefaultShouldBeApplied(
  key: string,
  sourceMap: Record<string, SourceInformation>
) {
  const sourceInfo = sourceMap[key];
  if (!sourceInfo) {
    return true;
  }
  // The defined value of the target is from a plugin that
  // isn't part of Nx's core plugins, so target defaults are
  // applied on top of it.
  const [, plugin] = sourceInfo;
  return !plugin?.startsWith('nx/');
}

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
        for (const optionKey in normalizedDefaults) {
          const sourceMapKey = targetOptionSourceMapKey(targetName, optionKey);
          if (
            targetDefinition.options[optionKey] === undefined ||
            targetDefaultShouldBeApplied(sourceMapKey, sourceMap)
          ) {
            result.options[optionKey] = targetDefault.options[optionKey];
            sourceMap[sourceMapKey] = ['nx.json', 'nx/target-defaults'];
          }
        }
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
          if (!result.configurations[configuration]) {
            result.configurations[configuration] = {};
            sourceMap[
              targetConfigurationsSourceMapKey(targetName, configuration)
            ] = ['nx.json', 'nx/target-defaults'];
          }
          const normalizedConfigurationDefaults = resolveNxTokensInOptions(
            targetDefault.configurations[configuration],
            project,
            targetName
          );
          for (const configurationKey in normalizedConfigurationDefaults) {
            const sourceMapKey = targetConfigurationsSourceMapKey(
              targetName,
              configuration,
              configurationKey
            );
            if (
              targetDefinition.configurations?.[configuration]?.[
                configurationKey
              ] === undefined ||
              targetDefaultShouldBeApplied(sourceMapKey, sourceMap)
            ) {
              result.configurations[configuration][configurationKey] =
                targetDefault.configurations[configuration][configurationKey];
              sourceMap[sourceMapKey] = ['nx.json', 'nx/target-defaults'];
            }
          }
        }
        break;
      }
      default: {
        const sourceMapKey = `targets.${targetName}.${key}`;
        if (
          targetDefinition[key] === undefined ||
          targetDefaultShouldBeApplied(sourceMapKey, sourceMap)
        ) {
          result[key] = targetDefault[key];
          sourceMap[sourceMapKey] = ['nx.json', 'nx/target-defaults'];
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
