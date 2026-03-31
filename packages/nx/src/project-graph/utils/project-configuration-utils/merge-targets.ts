import type {
  TargetConfiguration,
  TargetMetadata,
  ProjectMetadata,
} from '../../../config/workspace-json-project-json';
import type { SourceInformation } from '../project-configuration/source-maps';
import { uniqueKeysInObjects, getMergeValueResult } from './utils';

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
      for (const item of [...value]) {
        const newLength = result[metadataKey].push(item);
        if (sourceMap) {
          sourceMap[`${baseSourceMapPath}.${metadataKey}.${newLength - 1}`] =
            sourceInformation;
        }
      }
    } else if (Array.isArray(value) && existingValue === undefined) {
      result[metadataKey] ??= value;
      if (sourceMap) {
        sourceMap[`${baseSourceMapPath}.${metadataKey}`] = sourceInformation;
      }
      for (let i = 0; i < value.length; i++) {
        if (sourceMap) {
          sourceMap[`${baseSourceMapPath}.${metadataKey}.${i}`] =
            sourceInformation;
        }
      }
    } else if (typeof value === 'object' && typeof existingValue === 'object') {
      for (const key in value) {
        const existingValue = matchingMetadata?.[metadataKey]?.[key];

        if (Array.isArray(value[key]) && Array.isArray(existingValue)) {
          for (const item of value[key]) {
            const i = result[metadataKey][key].push(item);
            if (sourceMap) {
              sourceMap[`${baseSourceMapPath}.${metadataKey}.${key}.${i - 1}`] =
                sourceInformation;
            }
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
              for (let i = 0; i < value[k].length; i++) {
                sourceMap[`${baseSourceMapPath}.${metadataKey}.${k}.${i}`] =
                  sourceInformation;
              }
            }
          }
        }
      }
    }
  }
  return result;
}
