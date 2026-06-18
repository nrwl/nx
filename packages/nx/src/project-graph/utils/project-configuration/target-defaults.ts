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
 * Builds a synthetic plugin result from nx.json's `targetDefaults`, layered
 * between specified-plugin and default-plugin results during merging.
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

// Returns the synthetic defaults target to insert for `targetName` at
// `root`, or undefined if no defaults apply.
// Layering: specified plugins < target defaults < default plugins.
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

  // Specified-only: layer defaults on top, but only when the resulting
  // synthetic is compatible with the specified target. An incompatible
  // synthetic (e.g. `targetDefaults['test-native'] = { executor:
  // '@monodon/rust:test' }` while a polyglot plugin infers `test-native`
  // with `nx:run-commands`) would otherwise replace the specified target
  // wholesale during the downstream merge.
  if (resolvedSpecified && !resolvedDefault) {
    const targetDefaults = readAndPrepareTargetDefaults(
      targetName,
      resolvedSpecified.executor,
      root,
      targetDefaultsConfig
    );
    if (
      targetDefaults &&
      !isCompatibleTarget(resolvedSpecified, targetDefaults)
    ) {
      return undefined;
    }
    return targetDefaults;
  }

  // Default-only.
  if (resolvedDefault && !resolvedSpecified) {
    return readAndPrepareTargetDefaults(
      targetName,
      resolvedDefault.executor,
      root,
      targetDefaultsConfig
    );
  }

  if (!resolvedSpecified || !resolvedDefault) return undefined;

  // Both compatible: use the default plugin's executor for the lookup.
  // The same incompatibility check applies — a project.json `{}` entry
  // asks defaults to fill in the target, but the lookup can still fall
  // back to a target-name keyed default with a foreign executor that
  // would replace the inferred target. Skip the synthetic in that case.
  if (isCompatibleTarget(resolvedSpecified, resolvedDefault)) {
    const targetDefaults = readAndPrepareTargetDefaults(
      targetName,
      resolvedDefault.executor || resolvedSpecified.executor,
      root,
      targetDefaultsConfig
    );
    if (
      targetDefaults &&
      !isCompatibleTarget(resolvedSpecified, targetDefaults)
    ) {
      return undefined;
    }
    return targetDefaults;
  }

  // Incompatible: default plugin will replace specified; only defaults
  // matching the default plugin's executor are useful.
  const targetDefaults = readAndPrepareTargetDefaults(
    targetName,
    resolvedDefault.executor,
    root,
    targetDefaultsConfig
  );
  if (targetDefaults && isCompatibleTarget(resolvedDefault, targetDefaults)) {
    // Stamp executor/command so the default layer merges cleanly on top.
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
