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
  getProjects,
  readNxJson,
  updateNxJson,
} from 'nx/src/devkit-exports';
import {
  findMatchingConfigFiles,
  findMatchingProjects,
  readTargetDefaultsForTarget as readTargetDefaultsForTargetFromNx,
} from 'nx/src/devkit-internals';
import { minimatch } from 'minimatch';

/**
 * Upsert a `targetDefaults` entry on the provided `nxJson`. Mutates
 * `nxJson` in place and returns it so the caller can chain or batch
 * other edits before persisting via `updateNxJson` exactly once.
 *
 * The input is the logical {@link TargetDefaultEntry} shape
 * (`{ target?, executor?, projects?, plugin?, ...config }`). The `projects` /
 * `plugin` filter is *context* describing what the caller is configuring, used
 * to pick which existing entry to merge into — it is never authored as a new
 * filtered entry. For the key (`target` ?? `executor`):
 *
 * - No value yet → create the generic (plain object) value.
 * - Only a generic value → merge into it.
 * - A filtered entry matching the context filter exists → merge into that one
 *   (so a caller updating a project the user already scoped a default for edits
 *   that scoped entry rather than clobbering the workspace baseline).
 * - Otherwise → merge into the generic, creating one if needed.
 *
 * A lone unfiltered entry is always stored as a plain object, never a
 * single-element array. The entry must set at least one of `target` /
 * `executor`.
 */
export function upsertTargetDefault(
  tree: Tree,
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

  // `executor` is the map key itself when no `target` is given; when a `target`
  // is present it is a configuration field (a default executor) written onto
  // the value.
  const valueConfig: Partial<TargetConfiguration> =
    target !== undefined && executor !== undefined
      ? { executor, ...config }
      : config;

  const targetDefaults = (nxJson.targetDefaults ??= {});
  targetDefaults[key] = collapse(
    upsertValue(targetDefaults[key], valueConfig, {
      tree,
      projects,
      plugin,
      executor,
    })
  );

  return nxJson;
}

// What the caller is configuring, used to pick which existing entry to update.
interface UpsertContext {
  tree: Tree;
  projects: string | string[] | undefined;
  plugin: string | undefined;
  executor: string | undefined;
}

/**
 * Merge `config` into the right entry of a key's value, per the algorithm
 * documented on {@link upsertTargetDefault}. Returns the new value (always an
 * array here; {@link collapse} downgrades a lone unfiltered one to an object).
 */
function upsertValue(
  existing: TargetDefaultValue | undefined,
  config: Partial<TargetConfiguration>,
  context: UpsertContext
): TargetDefaultValue {
  // No value yet → create the generic.
  if (existing === undefined) {
    return { ...config };
  }

  const entries: TargetDefaultArrayEntry[] = Array.isArray(existing)
    ? [...existing]
    : [existing];

  // A filtered entry that covers what's being configured → merge into it,
  // preserving its filter.
  const matchIdx = entries.findIndex(
    (e) => e.filter !== undefined && filterCoversContext(e.filter, context)
  );
  if (matchIdx >= 0) {
    entries[matchIdx] = { ...entries[matchIdx], ...config };
    return entries;
  }

  // Otherwise merge into the generic (catch-all) entry, creating one if absent.
  const genericIdx = entries.findIndex((e) => e.filter === undefined);
  if (genericIdx >= 0) {
    const { filter: _filter, ...rest } = entries[genericIdx];
    entries[genericIdx] = { ...rest, ...config };
  } else {
    entries.push({ ...config });
  }
  return entries;
}

/**
 * Whether an entry's `filter` applies to what the caller is configuring:
 * `plugin` / `executor` must match exactly, and `projects` is evaluated as
 * *coverage* — every configured project must match the filter's patterns
 * (names, globs, `tag:`, directories, negation) via `findMatchingProjects`,
 * resolved against each project's tags/root in the tree. A `projects` filter
 * can't be confirmed when no project context is supplied (or the project
 * isn't in the tree), so it falls through to the generic.
 */
function filterCoversContext(
  filter: NonNullable<TargetDefaultArrayEntry['filter']>,
  context: UpsertContext
): boolean {
  if (filter.plugin !== undefined && filter.plugin !== context.plugin) {
    return false;
  }
  if (filter.executor !== undefined && filter.executor !== context.executor) {
    return false;
  }
  if (filter.projects !== undefined) {
    const configured =
      context.projects === undefined
        ? []
        : Array.isArray(context.projects)
          ? context.projects
          : [context.projects];
    if (configured.length === 0) {
      return false;
    }
    const nodes = contextProjectNodes(context.tree, configured);
    const patterns = Array.isArray(filter.projects)
      ? [...filter.projects]
      : [filter.projects];
    const matched = findMatchingProjects(patterns, nodes);
    if (!configured.every((project) => matched.includes(project))) {
      return false;
    }
  }
  return true;
}

function contextProjectNodes(
  tree: Tree,
  projectNames: string[]
): Record<string, { data: { root: string; tags?: string[] } }> {
  const projects = getProjects(tree);
  const nodes: Record<string, { data: { root: string; tags?: string[] } }> = {};
  for (const name of projectNames) {
    const config = projects.get(name);
    if (config) {
      nodes[name] = { data: { root: config.root, tags: config.tags } };
    }
  }
  return nodes;
}

/**
 * Collapse a key's value back to the plain object form when it has degenerated
 * to a single entry with no filter — at that point the array wrapper carries no
 * information the object form doesn't, and the object form is the tidier,
 * record-shape-compatible representation.
 */
function collapse(value: TargetDefaultValue): TargetDefaultValue {
  if (
    Array.isArray(value) &&
    value.length === 1 &&
    value[0].filter === undefined
  ) {
    return value[0];
  }
  return value;
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
  for (const entry of logicalTargetDefaultEntries(targetDefaults)) {
    if (
      entry.target === locator.target &&
      entry.executor === locator.executor &&
      projectsEqual(entry.projects, locator.projects) &&
      entry.plugin === locator.plugin
    ) {
      return entry;
    }
  }
  return undefined;
}

/**
 * Expand the nested `targetDefaults` map into its logical {@link
 * TargetDefaultEntry} view, one entry at a time. The key becomes `target` (or
 * `executor` for executor-shaped keys) and any `filter` is un-nested into the
 * flat `projects`/`plugin`/`executor` siblings. Lazy so callers that find a
 * match early stop iterating. Internal to this module — the flat shape is a
 * lookup convenience, never a `targetDefaults` value form.
 */
function* logicalTargetDefaultEntries(
  targetDefaults: TargetDefaults | undefined
): Generator<TargetDefaultEntry> {
  for (const key of Object.keys(targetDefaults ?? {})) {
    const locator = isExecutorLikeKey(key)
      ? { executor: key }
      : { target: key };
    const value = targetDefaults[key];
    const entries: TargetDefaultArrayEntry[] = Array.isArray(value)
      ? value
      : [value ?? {}];
    for (const entry of entries) {
      const { filter, ...config } = entry;
      yield {
        ...locator,
        ...(filter?.projects !== undefined
          ? { projects: filter.projects }
          : {}),
        ...(filter?.plugin !== undefined ? { plugin: filter.plugin } : {}),
        ...(filter?.executor !== undefined
          ? { executor: filter.executor }
          : {}),
        ...config,
      };
    }
  }
}

// Mirrors `isGlobPattern` from `nx/src/utils/globs.ts`, which isn't on the
// devkit-exports surface guaranteed across the supported nx version range.
const GLOB_CHARACTERS = new Set(['*', '|', '{', '}', '(', ')', '[']);
function isExecutorLikeKey(key: string): boolean {
  if (!key.includes(':')) return false;
  for (const c of key) if (GLOB_CHARACTERS.has(c)) return false;
  return true;
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
  // Only skip when an *unfiltered* entry already covers this executor.
  // A filtered entry (`projects:` or `plugin:`) only applies to a subset
  // of targets, so it doesn't satisfy the workspace-wide default this
  // helper writes — we still need to add the unfiltered baseline.
  if (findTargetDefault(nxJson.targetDefaults, { executor: executorName })) {
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
