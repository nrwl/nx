import {
  type CreateNodesV2,
  type PluginConfiguration,
  type TargetConfiguration,
  type TargetDefaultEntry,
  type TargetDefaults,
  type Tree,
  readNxJson,
  updateNxJson,
} from 'nx/src/devkit-exports';
import { findMatchingConfigFiles } from 'nx/src/devkit-internals';
import { normalizeTargetDefaults } from '../utils/normalize-target-defaults';

export interface UpsertTargetDefaultOptions
  extends Partial<TargetConfiguration> {
  target: string;
  projects?: string | string[];
  source?: string;
}

/**
 * Upsert a `targetDefaults` entry in nx.json. Reads the current shape
 * (array or legacy record), finds a matching entry by the
 * `(target, projects, source)` tuple, and merges the given config into
 * it (or appends a new entry).
 *
 * If nx.json uses the legacy record shape AND the caller provides a
 * `projects` or `source` filter, nx.json is upgraded to the array shape
 * because the record shape cannot express filtered entries.
 */
export function upsertTargetDefault(
  tree: Tree,
  options: UpsertTargetDefaultOptions
): void {
  const { target, projects, source, ...config } = options;
  const nxJson = readNxJson(tree) ?? {};
  const existing: TargetDefaults | undefined = nxJson.targetDefaults;
  const hasFilter = projects !== undefined || source !== undefined;

  // Legacy record shape, no filters → stay in record shape.
  if (existing && !Array.isArray(existing) && !hasFilter) {
    const record = { ...existing };
    record[target] = { ...(record[target] ?? {}), ...config };
    nxJson.targetDefaults = record;
    updateNxJson(tree, nxJson);
    return;
  }

  const entries = normalizeTargetDefaults(existing);
  const matchIndex = entries.findIndex(
    (e) =>
      e.target === target &&
      projectsEqual(e.projects, projects) &&
      e.source === source
  );

  const newEntry: TargetDefaultEntry = {
    target,
    ...(projects !== undefined ? { projects } : {}),
    ...(source !== undefined ? { source } : {}),
    ...config,
  };

  if (matchIndex >= 0) {
    const merged = { ...entries[matchIndex], ...config, target };
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
  const existing = nxJson.targetDefaults;
  const defaultConfig: Partial<TargetConfiguration> = {
    cache: true,
    dependsOn: [`^${buildTargetName}`],
    inputs: [
      ...(nxJson.namedInputs && 'production' in nxJson.namedInputs
        ? ['production', '^production']
        : ['default', '^default']),
      ...extraInputs,
    ],
  };

  // Preserve legacy record-shape behavior when nx.json is still in that
  // shape: only set the entry if one does not already exist at the
  // executor key, and do not upgrade to the array shape.
  if (existing && !Array.isArray(existing)) {
    if (existing[executorName]) return;
    nxJson.targetDefaults = { ...existing, [executorName]: defaultConfig };
    updateNxJson(tree, nxJson);
    return;
  }

  const entries = normalizeTargetDefaults(existing);
  if (entries.some((e) => e.target === executorName)) {
    return;
  }
  entries.push({ target: executorName, ...defaultConfig });
  nxJson.targetDefaults = entries;
  updateNxJson(tree, nxJson);
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
  const existing = nxJson.targetDefaults;

  // Legacy record-shape: preserve the existing mutate-in-place behavior.
  if (existing && !Array.isArray(existing)) {
    const current = existing[ciTargetNameGlob];
    if (!current) {
      existing[ciTargetNameGlob] = { dependsOn: [buildTarget] };
    } else {
      current.dependsOn ??= [];
      if (!current.dependsOn.includes(buildTarget)) {
        current.dependsOn.push(buildTarget);
      }
    }
    nxJson.targetDefaults = existing;
    updateNxJson(tree, nxJson);
    return;
  }

  const entries = normalizeTargetDefaults(existing);
  const matchIndex = entries.findIndex(
    (e) =>
      e.target === ciTargetNameGlob &&
      e.projects === undefined &&
      e.source === undefined
  );
  if (matchIndex < 0) {
    entries.push({ target: ciTargetNameGlob, dependsOn: [buildTarget] });
  } else {
    const entry = entries[matchIndex];
    entry.dependsOn ??= [];
    if (!(entry.dependsOn as (string | unknown)[]).includes(buildTarget)) {
      (entry.dependsOn as (string | unknown)[]).push(buildTarget);
    }
  }
  nxJson.targetDefaults = entries;
  updateNxJson(tree, nxJson);
}
