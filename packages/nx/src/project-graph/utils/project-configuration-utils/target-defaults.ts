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
  isCompatibleTarget,
  resolveCommandSyntacticSugar,
} from '../project-configuration/target-merging';

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
    return resolveCommandSyntacticSugar(targetDefaults, root);
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
        // Case 1: Specified target only, no default plugin target.
        // Target defaults take precedence over specified plugins, so
        // they're always layered on even when the executor differs —
        // the subsequent merge treats incompatible defaults as a full
        // replacement, which matches the
        //   specified plugin < target defaults < default plugin
        // precedence order.
        executorForDefaults = resolvedSpecified.executor;
        const targetDefaults = readAndPrepareTargetDefaults(
          targetName,
          executorForDefaults,
          root
        );
        if (targetDefaults) {
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
