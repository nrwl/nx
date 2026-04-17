import { minimatch } from 'minimatch';
import { NxJsonConfiguration, TargetDefaults } from '../../../config/nx-json';
import {
  ProjectConfiguration,
  TargetConfiguration,
} from '../../../config/workspace-json-project-json';
import { isGlobPattern } from '../../../utils/globs';
import type { CreateNodesResult } from '../../plugins/public-api';
import {
  deepClone,
  isCompatibleTarget,
  resolveCommandSyntacticSugar,
} from './target-merging';
import { uniqueKeysInObjects } from './utils';

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
  const targetDefaultsConfig = nxJsonConfiguration.targetDefaults;
  if (!targetDefaultsConfig) {
    return [];
  }

  const syntheticProjects: Record<string, ProjectConfiguration> = {};

  const allRoots = new Set<string>([
    ...Object.keys(specifiedPluginRootMap),
    ...Object.keys(defaultPluginRootMap),
  ]);

  for (const root of allRoots) {
    const specifiedTargets = specifiedPluginRootMap[root]?.targets ?? {};
    const defaultTargets = defaultPluginRootMap[root]?.targets ?? {};

    for (const targetName of uniqueKeysInObjects(
      specifiedTargets,
      defaultTargets
    )) {
      const syntheticTarget = buildSyntheticTargetForRoot(
        targetName,
        root,
        specifiedTargets[targetName],
        defaultTargets[targetName],
        targetDefaultsConfig
      );

      if (!syntheticTarget) continue;

      syntheticProjects[root] ??= { root, targets: {} };
      syntheticProjects[root].targets[targetName] = syntheticTarget;
    }
  }

  if (Object.keys(syntheticProjects).length === 0) {
    return [];
  }

  return [
    [
      'nx/target-defaults',
      'nx.json',
      {
        projects: syntheticProjects,
      },
    ],
  ];
}

/**
 * Decides whether a synthetic target-defaults entry should sit between a
 * specified-plugin target and a default-plugin target for `targetName` at
 * `root`. Returns the synthetic target to insert, or `undefined` if no
 * insertion is needed (e.g. no matching defaults, or the default plugin
 * will fully override the layer anyway).
 *
 * Layering order is: specified plugins < target defaults < default plugins.
 */
function buildSyntheticTargetForRoot(
  targetName: string,
  root: string,
  specifiedTarget: TargetConfiguration | undefined,
  defaultTarget: TargetConfiguration | undefined,
  targetDefaultsConfig: TargetDefaults
): TargetConfiguration | undefined {
  const resolvedSpecified = specifiedTarget
    ? resolveCommandSyntacticSugar(specifiedTarget, root)
    : undefined;
  const resolvedDefault = defaultTarget
    ? resolveCommandSyntacticSugar(defaultTarget, root)
    : undefined;

  // Specified-only: layer defaults on top regardless of executor match.
  // The downstream merge treats incompatible defaults as a full replace,
  // which is the right behaviour for the precedence order.
  if (resolvedSpecified && !resolvedDefault) {
    return readAndPrepareTargetDefaults(
      targetName,
      resolvedSpecified.executor,
      root,
      targetDefaultsConfig
    );
  }

  // Default-only: layer defaults beneath the default plugin target.
  if (resolvedDefault && !resolvedSpecified) {
    return readAndPrepareTargetDefaults(
      targetName,
      resolvedDefault.executor,
      root,
      targetDefaultsConfig
    );
  }

  if (!resolvedSpecified || !resolvedDefault) return undefined;

  // Both exist and are compatible: prefer the default plugin's executor
  // for the defaults lookup, so the surviving merge sees the target
  // defaults as a clean layer underneath.
  if (isCompatibleTarget(resolvedSpecified, resolvedDefault)) {
    return readAndPrepareTargetDefaults(
      targetName,
      resolvedDefault.executor || resolvedSpecified.executor,
      root,
      targetDefaultsConfig
    );
  }

  // Both exist but are incompatible: the default plugin will replace the
  // specified target, so the only useful synthetic layer is one whose
  // executor matches the default plugin.
  const targetDefaults = readAndPrepareTargetDefaults(
    targetName,
    resolvedDefault.executor,
    root,
    targetDefaultsConfig
  );
  if (targetDefaults && isCompatibleTarget(resolvedDefault, targetDefaults)) {
    // Stamp executor/command so the synthetic layer merges cleanly with
    // the default plugin layer above it.
    return {
      ...targetDefaults,
      executor: resolvedDefault.executor,
      command: resolvedDefault.command,
    };
  }

  return undefined;
}

function readAndPrepareTargetDefaults(
  targetName: string,
  executor: string | undefined,
  root: string,
  targetDefaultsConfig: TargetDefaults
): TargetConfiguration | undefined {
  const rawTargetDefaults = readTargetDefaultsForTarget(
    targetName,
    targetDefaultsConfig,
    executor
  );
  if (!rawTargetDefaults) return undefined;

  return resolveCommandSyntacticSugar(deepClone(rawTargetDefaults), root);
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
