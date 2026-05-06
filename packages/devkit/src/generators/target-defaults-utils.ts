import {
  type CreateNodesV2,
  type NxJsonConfiguration,
  type PluginConfiguration,
  type TargetConfiguration,
  type TargetDefaultEntry,
  type TargetDefaults,
  type Tree,
  readNxJson,
  updateNxJson,
} from 'nx/src/devkit-exports';
import { findMatchingConfigFiles } from 'nx/src/devkit-internals';
import { gte, valid } from 'semver';
import { NX_VERSION } from '../utils/package-json';
import {
  downgradeTargetDefaults,
  normalizeTargetDefaults,
} from '../utils/normalize-target-defaults';

// devkit supports `nx` at major +/- 1; on nx<23 the array shape doesn't
// exist yet, so writing array would produce an nx.json the installed nx
// can't validate. Promote-to-array only when nx is new enough; otherwise
// preserve a legacy record on disk. Treat unknown / placeholder versions
// (e.g. workspace dev "0.0.1" before publish replacement) as modern —
// the alternative would silently downgrade every monorepo dev test.
const SUPPORTS_ARRAY_TARGET_DEFAULTS =
  !valid(NX_VERSION) || NX_VERSION === '0.0.1' || gte(NX_VERSION, '23.0.0');

/**
 * Upsert a `targetDefaults` entry. Always writes the array shape — if the
 * underlying value still uses the legacy record shape, it is upgraded in
 * place. Finds a matching entry by the `(target, executor, projects,
 * source)` tuple and merges the given config into it, or appends a new
 * entry. The entry must set at least one of `target` / `executor`.
 *
 * Two call shapes:
 * - `(tree, options)` — reads/writes nx.json itself (single edit).
 * - `(tree, nxJson, options)` — mutates the provided `nxJson` in place
 *   and returns it so the caller can batch other edits before calling
 *   `updateNxJson` exactly once.
 */
export function upsertTargetDefault(
  tree: Tree,
  options: TargetDefaultEntry
): void;
export function upsertTargetDefault(
  tree: Tree,
  nxJson: NxJsonConfiguration,
  options: TargetDefaultEntry
): NxJsonConfiguration;
export function upsertTargetDefault(
  tree: Tree,
  arg2: TargetDefaultEntry | NxJsonConfiguration,
  arg3?: TargetDefaultEntry
): NxJsonConfiguration | void {
  const callerProvidedNxJson = arg3 !== undefined;
  const options = (callerProvidedNxJson ? arg3 : arg2) as TargetDefaultEntry;
  const nxJson = (
    callerProvidedNxJson ? arg2 : (readNxJson(tree) ?? {})
  ) as NxJsonConfiguration;

  if (options.target === undefined && options.executor === undefined) {
    throw new Error(
      'upsertTargetDefault requires at least one of `target` or `executor` to be set.'
    );
  }

  const { target, executor, projects, source, ...config } = options;
  const originalShape = nxJson.targetDefaults;
  const entries = normalizeTargetDefaults(originalShape);
  const matchIndex = entries.findIndex(
    (e) =>
      e.target === target &&
      e.executor === executor &&
      projectsEqual(e.projects, projects) &&
      e.source === source
  );

  if (matchIndex >= 0) {
    const existing = entries[matchIndex];
    const {
      target: et,
      executor: ee,
      projects: ep,
      source: es,
      ...existingRest
    } = existing;
    entries[matchIndex] = buildTargetDefaultEntry(
      target ?? et,
      projects ?? ep,
      source ?? es,
      executor ?? ee,
      { ...existingRest, ...config }
    );
  } else {
    entries.push(
      buildTargetDefaultEntry(target, projects, source, executor, config)
    );
  }

  nxJson.targetDefaults =
    SUPPORTS_ARRAY_TARGET_DEFAULTS || Array.isArray(originalShape)
      ? entries
      : downgradeTargetDefaults(entries);
  if (callerProvidedNxJson) {
    return nxJson;
  }
  updateNxJson(tree, nxJson);
}

/**
 * Find a `targetDefaults` entry by its locator tuple
 * `(target, executor, projects, source)`. Locator keys default to
 * `undefined`, matching only entries that also leave them unset — same
 * semantics as `upsertTargetDefault`. Accepts either array or legacy
 * record shape.
 */
export function findTargetDefault(
  targetDefaults: TargetDefaults | undefined,
  locator: Pick<
    TargetDefaultEntry,
    'target' | 'executor' | 'projects' | 'source'
  >
): TargetDefaultEntry | undefined {
  return normalizeTargetDefaults(targetDefaults).find(
    (e) =>
      e.target === locator.target &&
      e.executor === locator.executor &&
      projectsEqual(e.projects, locator.projects) &&
      e.source === locator.source
  );
}

/**
 * Construct a `TargetDefaultEntry` with the canonical key order
 * `target → projects → source → executor → ...rest`. Locators land first
 * so an entry's filter shape is obvious at a glance; `executor` follows
 * because it doubles as a payload field.
 */
function buildTargetDefaultEntry(
  target: string | undefined,
  projects: string | string[] | undefined,
  source: string | undefined,
  executor: string | undefined,
  rest: Partial<TargetConfiguration>
): TargetDefaultEntry {
  return {
    ...(target !== undefined ? { target } : {}),
    ...(projects !== undefined ? { projects } : {}),
    ...(source !== undefined ? { source } : {}),
    ...(executor !== undefined ? { executor } : {}),
    ...rest,
  };
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
  const existing = findTargetDefault(nxJson.targetDefaults, {
    target: ciTargetNameGlob,
  });
  const dependsOn = [...(existing?.dependsOn ?? [])];
  if (!dependsOn.includes(buildTarget)) {
    dependsOn.push(buildTarget);
  }
  upsertTargetDefault(tree, { target: ciTargetNameGlob, dependsOn });
}
