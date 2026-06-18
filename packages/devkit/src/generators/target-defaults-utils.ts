import {
  type CreateNodes,
  type NxJsonConfiguration,
  type PluginConfiguration,
  type TargetConfiguration,
  type TargetDefaultArrayEntry,
  type TargetDefaultEntry,
  type TargetDefaults,
  type TargetDefaultValue,
  type Tree,
  readNxJson,
  updateNxJson,
} from 'nx/src/devkit-exports';
import {
  findMatchingConfigFiles,
  readTargetDefaultsForTarget as readTargetDefaultsForTargetFromNx,
} from 'nx/src/devkit-internals';
import { minimatch } from 'minimatch';
import { normalizeTargetDefaults } from '../utils/normalize-target-defaults';

/**
 * Upsert a `targetDefaults` entry on the provided `nxJson`. Mutates
 * `nxJson` in place and returns it so the caller can chain or batch
 * other edits before persisting via `updateNxJson` exactly once.
 *
 * The input is the logical {@link TargetDefaultEntry} shape
 * (`{ target?, executor?, projects?, plugin?, ...config }`); it is
 * translated into the nested map storage form:
 *
 * - With no filter (`projects`/`plugin`/narrowing `executor`), the config is
 *   written/merged as the plain object value of the `target`/`executor` key.
 * - With a filter, the key's value is promoted to the ordered array form and
 *   the `{ filter, ...config }` entry is merged or appended.
 *
 * The entry must set at least one of `target` / `executor`.
 */
export function upsertTargetDefault(
  // Retained for call-site compatibility; the nested-array shape no longer
  // needs the workspace's projects to disambiguate `:`-shaped keys.
  _tree: Tree,
  nxJson: NxJsonConfiguration,
  options: TargetDefaultEntry
): NxJsonConfiguration {
  const { target, executor, projects, plugin, ...config } = options;
  const key = target ?? executor;
  if (key === undefined) {
    throw new Error(
      'upsertTargetDefault requires at least one of `target` or `executor` to be set.'
    );
  }

  // `executor` is the map key itself when no `target` is given; it only acts
  // as a filter when narrowing *within* a named target key.
  const filterExecutor = target !== undefined ? executor : undefined;
  const filter = buildFilter(plugin, projects, filterExecutor);

  const targetDefaults = (nxJson.targetDefaults ??= {});
  const existing = targetDefaults[key];

  targetDefaults[key] = filter
    ? upsertFilteredEntry(existing, filter, config)
    : upsertCatchAllEntry(existing, config);

  return nxJson;
}

/**
 * Find a `targetDefaults` entry by its logical locator tuple
 * `(target, executor, projects, plugin)`. Locator keys default to
 * `undefined`, matching only entries that also leave them unset — same
 * semantics as `upsertTargetDefault`.
 *
 * Throws when called with an empty locator (no `target`, `executor`,
 * `projects`, or `plugin`). An empty locator is almost always a bug — the
 * caller intended to find a specific entry but forgot to populate the lookup.
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
  // `targetDefaults` is the nested map; the nx reader resolves either the
  // object or array value form for `targetName` natively.
  return readTargetDefaultsForTargetFromNx(
    targetName,
    targetDefaults,
    executor,
    opts
  );
}

/**
 * Merge `config` into the catch-all (filter-less) default for a key. Returns
 * the new value for that key.
 */
function upsertCatchAllEntry(
  existing: TargetDefaultValue | undefined,
  config: Partial<TargetConfiguration>
): TargetDefaultValue {
  if (existing === undefined) {
    return { ...config };
  }
  if (!Array.isArray(existing)) {
    // Plain object form (today's shape) — merge, config winning.
    return { ...existing, ...config };
  }
  // Array form — merge into the existing catch-all entry, or append one.
  const next = [...existing];
  const idx = next.findIndex((e) => e.filter === undefined);
  if (idx >= 0) {
    const { filter, ...rest } = next[idx];
    next[idx] = { ...rest, ...config };
  } else {
    next.push({ ...config });
  }
  return next;
}

/**
 * Merge `config` into the entry matching `filter`, promoting the key's value
 * to the array form if needed. Returns the new array value for that key.
 */
function upsertFilteredEntry(
  existing: TargetDefaultValue | undefined,
  filter: NonNullable<TargetDefaultArrayEntry['filter']>,
  config: Partial<TargetConfiguration>
): TargetDefaultArrayEntry[] {
  const next: TargetDefaultArrayEntry[] =
    existing === undefined
      ? []
      : Array.isArray(existing)
        ? [...existing]
        : // Promote the existing object to a catch-all entry so the filtered
          // entry can layer on top of it.
          [existing];
  const idx = next.findIndex((e) => filtersEqual(e.filter, filter));
  if (idx >= 0) {
    next[idx] = { ...next[idx], ...config, filter };
  } else {
    next.push({ filter, ...config });
  }
  return next;
}

function buildFilter(
  plugin: string | undefined,
  projects: string | string[] | undefined,
  executor: string | undefined
): NonNullable<TargetDefaultArrayEntry['filter']> | undefined {
  if (
    plugin === undefined &&
    projects === undefined &&
    executor === undefined
  ) {
    return undefined;
  }
  return {
    ...(plugin !== undefined ? { plugin } : {}),
    ...(projects !== undefined ? { projects } : {}),
    ...(executor !== undefined ? { executor } : {}),
  };
}

function filtersEqual(
  a: TargetDefaultArrayEntry['filter'],
  b: TargetDefaultArrayEntry['filter']
): boolean {
  if (a === undefined || b === undefined) return a === b;
  return (
    a.plugin === b.plugin &&
    a.executor === b.executor &&
    projectsEqual(a.projects, b.projects)
  );
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
    createNodes?: CreateNodes;
    createNodesV2?: CreateNodes;
  } = await import(e2ePlugin);
  const e2ePluginGlob =
    resolvedE2ePlugin.createNodes?.[0] ?? resolvedE2ePlugin.createNodesV2?.[0];
  // The e2e config file must be one this plugin actually processes (its path
  // matches the plugin's createNodes glob) before the registration's
  // include/exclude filters are applied.
  const e2eConfigMatchesPluginGlob =
    !e2ePluginGlob ||
    minimatch(pathToE2EConfigFile, e2ePluginGlob, { dot: true });

  let foundPluginForApplication: PluginConfiguration;
  for (let i = 0; i < e2ePluginRegistrations.length; i++) {
    let candidatePluginForApplication = e2ePluginRegistrations[i];
    if (typeof candidatePluginForApplication === 'string') {
      foundPluginForApplication = candidatePluginForApplication;
      break;
    }

    const matchingConfigFiles = e2eConfigMatchesPluginGlob
      ? findMatchingConfigFiles(
          [pathToE2EConfigFile],
          candidatePluginForApplication.include,
          candidatePluginForApplication.exclude
        )
      : [];

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
