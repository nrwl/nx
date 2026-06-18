import type {
  TargetConfiguration,
  TargetDefaultArrayEntry,
  TargetDefaultEntry,
  TargetDefaults,
} from 'nx/src/devkit-exports';

// Mirrors `GLOB_CHARACTERS` / `isGlobPattern` from
// `nx/src/utils/globs.ts`. We can't import from there directly: devkit
// supports nx +/- 1 major version and that file isn't part of the
// devkit-exports surface guaranteed across the range. Keeping a local
// copy that exactly matches the canonical implementation avoids the
// import while staying behaviorally aligned.
const GLOB_CHARACTERS = new Set(['*', '|', '{', '}', '(', ')', '[']);

/**
 * Expand an nx.json `targetDefaults` map into a flat list of logical
 * {@link TargetDefaultEntry}s — the shape generators and migrations find,
 * filter, and read. Each map key contributes one entry per value (a bare
 * object value yields a single entry; an array value yields one per element),
 * with the key projected onto `target` (or `executor` for executor-shaped
 * keys) and any `filter` un-nested back into the flat `projects`/`plugin`/
 * `executor` siblings.
 *
 * This is the inverse of {@link denormalizeTargetDefaults}. The flattened
 * shape keeps existing call sites (`.find((e) => e.target === 'build')`)
 * working without them having to understand the nested storage form.
 *
 * Callers must not mutate the returned entries if they want to preserve the
 * underlying nx.json — the config payload is shallow-copied per entry.
 */
export function normalizeTargetDefaults(
  raw: TargetDefaults | undefined
): TargetDefaultEntry[] {
  if (!raw) return [];
  const out: TargetDefaultEntry[] = [];
  for (const key of Object.keys(raw)) {
    const locator: Pick<TargetDefaultEntry, 'target' | 'executor'> =
      isExecutorLikeKey(key) ? { executor: key } : { target: key };
    const value = raw[key];
    const entries: TargetDefaultArrayEntry[] = Array.isArray(value)
      ? value
      : [value ?? {}];
    for (const entry of entries) {
      const { filter, ...config } = entry;
      out.push({
        ...locator,
        ...(filter?.projects !== undefined
          ? { projects: filter.projects }
          : {}),
        ...(filter?.plugin !== undefined ? { plugin: filter.plugin } : {}),
        ...(filter?.executor !== undefined
          ? { executor: filter.executor }
          : {}),
        ...config,
      });
    }
  }
  return out;
}

/**
 * Collapse a flat list of logical {@link TargetDefaultEntry}s back into the
 * nested `targetDefaults` map — the inverse of {@link normalizeTargetDefaults}.
 *
 * Entries are grouped by their key (`target`, else `executor`). A key with a
 * single unfiltered entry is written as a plain object (today's shape); a key
 * with any filtered entry — or more than one entry — is written as an ordered
 * array of `{ filter?, ...config }` entries, preserving input order.
 *
 * Throws when an entry has neither `target` nor `executor` (no key to group
 * under). Silently dropping it would corrupt nx.json without the user
 * noticing.
 */
export function denormalizeTargetDefaults(
  entries: TargetDefaultEntry[]
): TargetDefaults {
  const grouped = new Map<string, TargetDefaultArrayEntry[]>();
  for (const entry of entries) {
    const { target, executor, projects, plugin, ...config } = entry;
    const key = target ?? executor;
    if (key === undefined) {
      throw new Error(
        `Cannot write targetDefaults: entry ${JSON.stringify(
          entry
        )} has neither \`target\` nor \`executor\` to use as the map key.`
      );
    }
    // `executor` is the map key when no `target` is set; when a `target` is
    // present it is a configuration field (a default executor) that stays on
    // the value — never normalized into a filter.
    const valueConfig: Partial<TargetConfiguration> =
      target !== undefined && executor !== undefined
        ? { executor, ...(config as Partial<TargetConfiguration>) }
        : (config as Partial<TargetConfiguration>);
    const filter = buildFilter(plugin, projects);
    const arrayEntry: TargetDefaultArrayEntry = filter
      ? { filter, ...valueConfig }
      : valueConfig;
    const existing = grouped.get(key);
    if (existing) existing.push(arrayEntry);
    else grouped.set(key, [arrayEntry]);
  }

  const out: TargetDefaults = {};
  for (const [key, group] of grouped) {
    // A lone unfiltered entry is equivalent to (and tidier as) the plain
    // object form; anything else needs the ordered array form.
    out[key] =
      group.length === 1 && group[0].filter === undefined ? group[0] : group;
  }
  return out;
}

function buildFilter(
  plugin: string | undefined,
  projects: string | string[] | undefined
): TargetDefaultArrayEntry['filter'] | undefined {
  if (plugin === undefined && projects === undefined) {
    return undefined;
  }
  return {
    ...(plugin !== undefined ? { plugin } : {}),
    ...(projects !== undefined ? { projects } : {}),
  };
}

function isExecutorLikeKey(key: string): boolean {
  if (!key.includes(':')) return false;
  for (const c of key) if (GLOB_CHARACTERS.has(c)) return false;
  return true;
}
