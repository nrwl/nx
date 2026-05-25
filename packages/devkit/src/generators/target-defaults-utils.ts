import {
  type CreateNodesV2,
  type NxJsonConfiguration,
  type PluginConfiguration,
  type ProjectConfiguration,
  type TargetConfiguration,
  type TargetDefaultEntry,
  type TargetDefaults,
  type TargetDefaultsRecord,
  type Tree,
  getProjects,
  readNxJson,
  updateNxJson,
} from 'nx/src/devkit-exports';
import {
  findMatchingConfigFiles,
  normalizeTargetDefaultsAgainstRootMaps,
  readTargetDefaultsForTarget as readTargetDefaultsForTargetFromNx,
} from 'nx/src/devkit-internals';
import { major, valid } from 'semver';
import { NX_VERSION } from '../utils/package-json';
import {
  downgradeTargetDefaults,
  normalizeTargetDefaults,
} from '../utils/normalize-target-defaults';

// Only write the array shape on nx >= 23 (workspace placeholder "0.0.1"
// counts as modern); older nx can't validate it. Major-only compare so
// pre-release tags like `23.0.0-beta.8` count as nx 23.
const SUPPORTS_ARRAY_TARGET_DEFAULTS =
  !valid(NX_VERSION) || NX_VERSION === '0.0.1' || major(NX_VERSION) >= 23;

/**
 * Upsert a `targetDefaults` entry on the provided `nxJson`. Mutates
 * `nxJson` in place and returns it so the caller can chain or batch
 * other edits before persisting via `updateNxJson` exactly once.
 *
 * Always writes the array shape — if the underlying value still uses
 * the legacy record shape, it is upgraded in place. Finds a matching
 * entry by the `(target, executor, projects, plugin)` tuple and merges
 * the given config into it, or appends a new entry. The entry must set
 * at least one of `target` / `executor`.
 */
export function upsertTargetDefault(
  tree: Tree,
  nxJson: NxJsonConfiguration,
  options: TargetDefaultEntry
): NxJsonConfiguration {
  if (options.target === undefined && options.executor === undefined) {
    throw new Error(
      'upsertTargetDefault requires at least one of `target` or `executor` to be set.'
    );
  }

  const { target, executor, projects, plugin, ...config } = options;
  const originalShape = nxJson.targetDefaults;
  // Copy — `normalizeTargetDefaults` returns the input array as-is when
  // it's already array shape. Without the spread, `entries[matchIndex] = ...`
  // and `entries.push(...)` would mutate the user's array reference (and
  // any other holders of the same `nxJson.targetDefaults` reference).
  const entries = [...normalizeTargetDefaultsForUpsert(tree, originalShape)];
  const matchIndex = entries.findIndex(
    (e) =>
      e.target === target &&
      e.executor === executor &&
      projectsEqual(e.projects, projects) &&
      e.plugin === plugin
  );

  if (matchIndex >= 0) {
    const existing = entries[matchIndex];
    const {
      target: et,
      executor: ee,
      projects: ep,
      plugin: ep2,
      ...existingRest
    } = existing;
    entries[matchIndex] = buildTargetDefaultEntry(
      target ?? et,
      projects ?? ep,
      plugin ?? ep2,
      executor ?? ee,
      { ...existingRest, ...config }
    );
  } else {
    entries.push(
      buildTargetDefaultEntry(target, projects, plugin, executor, config)
    );
  }

  // Preserve the record shape on pre-v23 nx when possible; promote to
  // array if any entry can't be represented in record form.
  if (SUPPORTS_ARRAY_TARGET_DEFAULTS || Array.isArray(originalShape)) {
    nxJson.targetDefaults = entries;
  } else {
    try {
      nxJson.targetDefaults = downgradeTargetDefaults(entries);
    } catch {
      nxJson.targetDefaults = entries;
    }
  }
  return nxJson;
}

/**
 * Find a `targetDefaults` entry by its locator tuple
 * `(target, executor, projects, plugin)`. Locator keys default to
 * `undefined`, matching only entries that also leave them unset — same
 * semantics as `upsertTargetDefault`. Accepts either array or legacy
 * record shape.
 *
 * Throws when called with an empty locator (no `target`, `executor`,
 * `projects`, or `plugin`). An empty locator is almost always a bug —
 * the caller intended to find a specific entry but forgot to populate
 * the lookup. Returning the first matching entry (or `undefined`) would
 * silently mask the mistake.
 */
export function findTargetDefault(
  targetDefaults: TargetDefaults | undefined,
  locator: Pick<
    TargetDefaultEntry,
    'target' | 'executor' | 'projects' | 'plugin'
  >
): TargetDefaultEntry | undefined {
  if (
    locator.target === undefined &&
    locator.executor === undefined &&
    locator.projects === undefined &&
    locator.plugin === undefined
  ) {
    throw new Error(
      'findTargetDefault requires at least one of `target`, `executor`, `projects`, or `plugin` on the locator.'
    );
  }
  return normalizeTargetDefaults(targetDefaults).find(
    (e) =>
      e.target === locator.target &&
      e.executor === locator.executor &&
      projectsEqual(e.projects, locator.projects) &&
      e.plugin === locator.plugin
  );
}

export function readTargetDefaultsForTarget(
  targetName: string,
  targetDefaults: TargetDefaults | undefined,
  executor?: string,
  opts?: Parameters<typeof readTargetDefaultsForTargetFromNx>[3]
): Partial<TargetConfiguration> | null {
  if (
    targetDefaults &&
    !Array.isArray(targetDefaults) &&
    Object.prototype.hasOwnProperty.call(targetDefaults, targetName)
  ) {
    return (targetDefaults as TargetDefaultsRecord)[targetName] ?? null;
  }

  return readTargetDefaultsForTargetFromNx(
    targetName,
    targetDefaults,
    executor,
    opts
  );
}

function normalizeTargetDefaultsForUpsert(
  tree: Tree,
  targetDefaults: TargetDefaults | undefined
): TargetDefaultEntry[] {
  if (!targetDefaults) {
    return [];
  }
  if (Array.isArray(targetDefaults)) {
    return targetDefaults;
  }

  return normalizeTargetDefaultsAgainstRootMaps(
    targetDefaults,
    buildProjectRootMap(getProjects(tree))
  );
}

function buildProjectRootMap(
  projects: Map<string, ProjectConfiguration>
): Record<string, ProjectConfiguration> {
  return Object.fromEntries(
    [...projects.values()].map((project) => [project.root, project])
  );
}

/**
 * Construct a `TargetDefaultEntry` with the canonical key order
 * `target → projects → plugin → executor → ...rest`. Locators land first
 * so an entry's filter shape is obvious at a glance; `executor` follows
 * because it doubles as a payload field.
 */
function buildTargetDefaultEntry(
  target: string | undefined,
  projects: string | string[] | undefined,
  plugin: string | undefined,
  executor: string | undefined,
  rest: Partial<TargetConfiguration>
): TargetDefaultEntry {
  return {
    ...(target !== undefined ? { target } : {}),
    ...(projects !== undefined ? { projects } : {}),
    ...(plugin !== undefined ? { plugin } : {}),
    ...(executor !== undefined ? { executor } : {}),
    ...rest,
  };
}

// Order-insensitive equality so re-upserts with reordered patterns
// merge into the same entry rather than appending a duplicate.
function projectsEqual(
  a: string | string[] | undefined,
  b: string | string[] | undefined
): boolean {
  if (a === b) return true;
  const aArr = a === undefined ? undefined : Array.isArray(a) ? a : [a];
  const bArr = b === undefined ? undefined : Array.isArray(b) ? b : [b];
  if (!aArr || !bArr) return false;
  if (aArr.length !== bArr.length) return false;
  const aSet = new Set(aArr);
  if (aSet.size !== aArr.length) {
    // Duplicates inside one array — fall back to positional comparison so
    // we don't silently merge `['a','a']` with `['a']`.
    for (let i = 0; i < aArr.length; i++) if (aArr[i] !== bArr[i]) return false;
    return true;
  }
  for (const item of bArr) if (!aSet.has(item)) return false;
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
  // Only skip when an *unfiltered* entry already covers this executor.
  // A filtered entry (`projects:` or `plugin:`) only applies to a subset
  // of targets, so it doesn't satisfy the workspace-wide default this
  // helper writes — we still need to add the unfiltered baseline.
  if (
    entries.some(
      (e) =>
        e.executor === executorName &&
        e.projects === undefined &&
        e.plugin === undefined
    )
  ) {
    return;
  }
  upsertTargetDefault(tree, nxJson, {
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
  const existing = findTargetDefault(nxJson.targetDefaults, {
    target: ciTargetNameGlob,
  });
  const dependsOn = [...(existing?.dependsOn ?? [])];
  if (!dependsOn.includes(buildTarget)) {
    dependsOn.push(buildTarget);
  }
  upsertTargetDefault(tree, nxJson, { target: ciTargetNameGlob, dependsOn });
  updateNxJson(tree, nxJson);
}
