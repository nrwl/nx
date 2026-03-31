import { NxJsonConfiguration, TargetDefaults } from '../../../config/nx-json';
import {
  ProjectConfiguration,
  TargetConfiguration,
} from '../../../config/workspace-json-project-json';
import { isGlobPattern } from '../../../utils/globs';
import { minimatch } from 'minimatch';
import type { CreateNodesResult } from '../../plugins/public-api';
import {
  deepClone,
  getMergeValueResult,
  resolveCommandSyntacticSugar,
  resolveNxTokensInOptions,
} from './utils';
import { isCompatibleTarget } from './merge-targets';
import type { SourceInformation } from '../project-configuration/source-maps';

type CreateNodesResultEntry = readonly [
  plugin: string,
  file: string,
  result: CreateNodesResult,
  pluginIndex?: number,
];

/**
 * Creates a synthetic plugin result containing target defaults for targets
 * that will be introduced by default plugins. This forms a middle layer that
 * gets merged between specified plugins and default plugins.
 *
 * @param specifiedPluginRootMap Merged results from specified plugins (from nx.json)
 * @param defaultPluginRootMap Merged results from default plugins (project.json, package.json)
 * @param nxJsonConfiguration The nx.json configuration containing target defaults
 */
export function createTargetDefaultsResults(
  specifiedPluginRootMap: Record<string, ProjectConfiguration>,
  defaultPluginRootMap: Record<string, ProjectConfiguration>,
  nxJsonConfiguration: NxJsonConfiguration
): CreateNodesResultEntry[] {
  if (!nxJsonConfiguration.targetDefaults) {
    return [];
  }

  const syntheticProjects: Record<string, ProjectConfiguration> = {};

  // Helper to read target defaults and prepare them with token resolution
  const readAndPrepareTargetDefaults = (
    targetName: string,
    executor: string | undefined,
    root: string
  ): TargetConfiguration | undefined => {
    const rawTargetDefaults = readTargetDefaultsForTarget(
      targetName,
      nxJsonConfiguration.targetDefaults,
      executor
    );

    if (!rawTargetDefaults) return undefined;

    const targetDefaults = deepClone(rawTargetDefaults);
    const errorMsgKey = ['nx.json[targetDefaults]', targetName].join(':');
    const normalizedDefaults = resolveCommandSyntacticSugar(
      targetDefaults,
      root
    );

    // Resolve Nx tokens in target default options
    const projectForTokens = specifiedPluginRootMap[root] ||
      defaultPluginRootMap[root] ||
      syntheticProjects[root] || { root };
    normalizedDefaults.options = resolveNxTokensInOptions(
      normalizedDefaults.options,
      projectForTokens,
      errorMsgKey
    );
    for (const configuration in normalizedDefaults.configurations) {
      normalizedDefaults.configurations[configuration] =
        resolveNxTokensInOptions(
          normalizedDefaults.configurations[configuration],
          projectForTokens,
          `${errorMsgKey}:${configuration}`
        );
    }

    return normalizedDefaults;
  };

  // Get all unique project roots that have targets from either specified or default plugins
  const allRoots = new Set<string>([
    ...Object.keys(specifiedPluginRootMap).filter(
      (root) => specifiedPluginRootMap[root]?.targets
    ),
    ...Object.keys(defaultPluginRootMap).filter(
      (root) => defaultPluginRootMap[root]?.targets
    ),
  ]);

  for (const root of allRoots) {
    const specifiedTargets = specifiedPluginRootMap[root]?.targets || {};
    const defaultTargets = defaultPluginRootMap[root]?.targets || {};

    // Get all unique target names for this project
    const allTargetNames = new Set([
      ...Object.keys(specifiedTargets),
      ...Object.keys(defaultTargets),
    ]);

    for (const targetName of allTargetNames) {
      const specifiedTarget = specifiedTargets[targetName];
      const defaultTarget = defaultTargets[targetName];

      // Resolve syntactic sugar for both targets
      const resolvedSpecified = specifiedTarget
        ? resolveCommandSyntacticSugar(specifiedTarget, root)
        : undefined;
      const resolvedDefault = defaultTarget
        ? resolveCommandSyntacticSugar(defaultTarget, root)
        : undefined;

      // Determine which executor to use for target defaults lookup
      let executorForDefaults: string | undefined;
      let syntheticTarget: TargetConfiguration | undefined;

      if (!resolvedDefault && resolvedSpecified) {
        // Case 1: Specified target only, no default plugin target
        executorForDefaults = resolvedSpecified.executor;
        const targetDefaults = readAndPrepareTargetDefaults(
          targetName,
          executorForDefaults,
          root
        );
        if (targetDefaults) {
          // Return defaults as-is, they'll merge on top of specified target
          syntheticTarget = targetDefaults;
        }
      } else if (resolvedDefault && !resolvedSpecified) {
        // Case 2: Default plugin target only, no specified target
        executorForDefaults = resolvedDefault.executor;
        const targetDefaults = readAndPrepareTargetDefaults(
          targetName,
          executorForDefaults,
          root
        );
        if (targetDefaults) {
          // Return defaults as-is, they'll merge beneath default plugin target
          syntheticTarget = targetDefaults;
        }
      } else if (resolvedDefault && resolvedSpecified) {
        // Both targets exist - check compatibility
        const targetsAreCompatible = isCompatibleTarget(
          resolvedSpecified,
          resolvedDefault
        );

        if (targetsAreCompatible) {
          // Targets are compatible - use the executor from either (prefer default)
          executorForDefaults =
            resolvedDefault.executor || resolvedSpecified.executor;
          const targetDefaults = readAndPrepareTargetDefaults(
            targetName,
            executorForDefaults,
            root
          );
          if (targetDefaults) {
            // Return defaults as-is, they'll merge properly
            syntheticTarget = targetDefaults;
          }
        } else {
          // Targets are incompatible - default plugin will override specified
          // Check if target defaults would work with the default plugin target
          executorForDefaults = resolvedDefault.executor;
          const targetDefaults = readAndPrepareTargetDefaults(
            targetName,
            executorForDefaults,
            root
          );

          if (targetDefaults) {
            if (isCompatibleTarget(resolvedDefault, targetDefaults)) {
              // Case 3: Target defaults are compatible with default plugin
              // Include executor/command to ensure proper layering:
              // specified <- defaults (with executor) <- default plugin
              syntheticTarget = {
                ...targetDefaults,
                executor: resolvedDefault.executor,
                command: resolvedDefault.command,
              };
            }
            // Case 4: Target defaults only compatible with specified target
            // Don't return anything - default plugin will override everything anyway
          }
        }
      }

      // Add synthetic target if we determined one should be created
      if (syntheticTarget) {
        if (!syntheticProjects[root]) {
          syntheticProjects[root] = {
            root,
            targets: {},
          };
        }
        if (!syntheticProjects[root].targets) {
          syntheticProjects[root].targets = {};
        }

        syntheticProjects[root].targets[targetName] = syntheticTarget;
      }
    }
  }

  if (Object.keys(syntheticProjects).length === 0) {
    return [];
  }

  // Create synthetic plugin result
  const syntheticResult: CreateNodesResultEntry = [
    'nx/target-defaults',
    'nx.json',
    {
      projects: syntheticProjects,
    },
  ];

  return [syntheticResult];
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
          sourceMap[`targets.${targetName}.configurations`] = [
            'nx.json',
            'nx/target-defaults',
          ];
        }
        for (const configuration in targetDefault.configurations) {
          // easy case, target defaults is adding a new configuration, nothing to merge.
          if (!result.configurations[configuration]) {
            result.configurations[configuration] = {};
            sourceMap[`targets.${targetName}.configurations.${configuration}`] =
              ['nx.json', 'nx/target-defaults'];
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
