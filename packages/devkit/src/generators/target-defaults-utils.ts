import {
  type CreateNodesV2,
  type PluginConfiguration,
  type TargetConfiguration,
  type TargetDefaultEntry,
  type Tree,
  readNxJson,
  updateNxJson,
} from 'nx/src/devkit-exports';
import { findMatchingConfigFiles } from 'nx/src/devkit-internals';
import { normalizeTargetDefaults } from '../utils/normalize-target-defaults';

/**
 * Upsert a `targetDefaults` entry in nx.json. Always writes the array
 * shape — if nx.json still uses the legacy record shape, it is upgraded
 * in place. Finds a matching entry by the
 * `(target, executor, projects, source)` tuple and merges the given
 * config into it, or appends a new entry.
 *
 * The entry must set at least one of `target` / `executor`.
 */
export function upsertTargetDefault(
  tree: Tree,
  options: TargetDefaultEntry
): void {
  if (options.target === undefined && options.executor === undefined) {
    throw new Error(
      'upsertTargetDefault requires at least one of `target` or `executor` to be set.'
    );
  }

  const { target, executor, projects, source, ...config } = options;
  const nxJson = readNxJson(tree) ?? {};
  const entries = normalizeTargetDefaults(nxJson.targetDefaults);
  const matchIndex = entries.findIndex(
    (e) =>
      e.target === target &&
      e.executor === executor &&
      projectsEqual(e.projects, projects) &&
      e.source === source
  );

  const newEntry: TargetDefaultEntry = {
    ...(target !== undefined ? { target } : {}),
    ...(executor !== undefined ? { executor } : {}),
    ...(projects !== undefined ? { projects } : {}),
    ...(source !== undefined ? { source } : {}),
    ...config,
  };

  if (matchIndex >= 0) {
    const merged: TargetDefaultEntry = { ...entries[matchIndex], ...config };
    if (target !== undefined) merged.target = target;
    if (executor !== undefined) merged.executor = executor;
    if (projects !== undefined) merged.projects = projects;
    if (source !== undefined) merged.source = source;
    entries[matchIndex] = merged;
  } else {
    entries.push(newEntry);
  }

  nxJson.targetDefaults = entries;
  updateNxJson(tree, nxJson);
}

function projectsEqual(
  a: string | string[] | undefined,
  b: string | string[] | undefined
): boolean {
  if (a === b) return true;
  const aArr = a === undefined ? undefined : Array.isArray(a) ? a : [a];
  const bArr = b === undefined ? undefined : Array.isArray(b) ? b : [b];
  if (!aArr || !bArr) return false;
  if (aArr.length !== bArr.length) return false;
  for (let i = 0; i < aArr.length; i++) if (aArr[i] !== bArr[i]) return false;
  return true;
}

export function addBuildTargetDefaults(
  tree: Tree,
  executorName: string,
  buildTargetName = 'build',
  extraInputs: TargetConfiguration['inputs'] = []
): void {
  const nxJson = readNxJson(tree) ?? {};
  const entries = normalizeTargetDefaults(nxJson.targetDefaults);
  if (entries.some((e) => e.executor === executorName)) {
    return;
  }
  upsertTargetDefault(tree, {
    executor: executorName,
    cache: true,
    dependsOn: [`^${buildTargetName}`],
    inputs: [
      ...(nxJson.namedInputs && 'production' in nxJson.namedInputs
        ? ['production', '^production']
        : ['default', '^default']),
      ...extraInputs,
    ],
  });
}

export async function addE2eCiTargetDefaults(
  tree: Tree,
  e2ePlugin: string,
  buildTarget: string,
  pathToE2EConfigFile: string
): Promise<void> {
  const nxJson = readNxJson(tree);
  if (!nxJson?.plugins) {
    return;
  }

  const e2ePluginRegistrations = nxJson.plugins.filter((p) =>
    typeof p === 'string' ? p === e2ePlugin : p.plugin === e2ePlugin
  );
  if (!e2ePluginRegistrations.length) {
    return;
  }

  const resolvedE2ePlugin: {
    createNodes?: CreateNodesV2;
    createNodesV2?: CreateNodesV2;
  } = await import(e2ePlugin);
  const e2ePluginGlob =
    resolvedE2ePlugin.createNodesV2?.[0] ?? resolvedE2ePlugin.createNodes?.[0];

  let foundPluginForApplication: PluginConfiguration;
  for (let i = 0; i < e2ePluginRegistrations.length; i++) {
    let candidatePluginForApplication = e2ePluginRegistrations[i];
    if (typeof candidatePluginForApplication === 'string') {
      foundPluginForApplication = candidatePluginForApplication;
      break;
    }

    const matchingConfigFiles = findMatchingConfigFiles(
      [pathToE2EConfigFile],
      e2ePluginGlob,
      candidatePluginForApplication.include,
      candidatePluginForApplication.exclude
    );

    if (matchingConfigFiles.length) {
      foundPluginForApplication = candidatePluginForApplication;
      break;
    }
  }

  if (!foundPluginForApplication) {
    return;
  }

  const ciTargetName =
    typeof foundPluginForApplication === 'string'
      ? 'e2e-ci'
      : ((foundPluginForApplication.options as any)?.ciTargetName ?? 'e2e-ci');

  const ciTargetNameGlob = `${ciTargetName}--**/**`;
  const existing = normalizeTargetDefaults(nxJson.targetDefaults).find(
    (e) =>
      e.target === ciTargetNameGlob &&
      e.executor === undefined &&
      e.projects === undefined &&
      e.source === undefined
  );
  const dependsOn = [...(existing?.dependsOn ?? [])];
  if (!dependsOn.includes(buildTarget)) {
    dependsOn.push(buildTarget);
  }
  upsertTargetDefault(tree, { target: ciTargetNameGlob, dependsOn });
}
