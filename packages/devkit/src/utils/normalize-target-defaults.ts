import type {
  TargetDefaultEntry,
  TargetDefaults,
  TargetDefaultsRecord,
} from 'nx/src/devkit-exports';

// Mirrors `GLOB_CHARACTERS` / `isGlobPattern` from
// `nx/src/utils/globs.ts`. We can't import from there directly: devkit
// supports nx +/- 1 major version and that file isn't part of the
// devkit-exports surface guaranteed across the range. Keeping a local
// copy that exactly matches the canonical implementation avoids the
// import while staying behaviorally aligned.
const GLOB_CHARACTERS = new Set(['*', '|', '{', '}', '(', ')', '[']);

/**
 * Convert an nx.json `targetDefaults` value (either the legacy record shape
 * or the new array shape) into the normalized array shape.
 *
 * Record entries become `{ target: key, ...value }` preserving insertion
 * order — except executor-shaped keys (e.g. `@nx/vite:test`,
 * `nx:run-commands`), which become `{ executor: key, ...value }`.
 *
 * Returns the array directly when already normalized — callers must not
 * mutate the result if they want to preserve the underlying nx.json.
 */
export function normalizeTargetDefaults(
  raw: TargetDefaults | undefined
): TargetDefaultEntry[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  const out: TargetDefaultEntry[] = [];
  const record = raw as TargetDefaultsRecord;
  for (const key of Object.keys(record)) {
    const value = record[key] ?? {};
    out.push(
      isExecutorLikeKey(key)
        ? { ...value, executor: key }
        : { ...value, target: key }
    );
  }
  return out;
}

function isExecutorLikeKey(key: string): boolean {
  if (!key.includes(':')) return false;
  for (const c of key) if (GLOB_CHARACTERS.has(c)) return false;
  return true;
}

/**
 * Project an array of `TargetDefaultEntry` back into the legacy
 * record shape. The intended caller is a pre-v23 migration that
 * normalized to array internally but wants to preserve the original
 * on-disk record shape so it remains valid against pre-v23 nx.json
 * schemas.
 *
 * Each entry's key is its `target` (if set) or `executor`. Entries that
 * have both keep the locator role on `target` and retain `executor` as
 * a value field.
 *
 * Throws when the input contains entries that the record shape cannot
 * represent — `projects`/`plugin` filters, two entries that would collapse
 * to the same key, or entries with neither `target` nor `executor`. The
 * caller must keep array shape in those cases (or refuse to write the
 * change). Silently dropping these entries would corrupt nx.json without
 * the user noticing.
 */
export function downgradeTargetDefaults(
  entries: TargetDefaultEntry[]
): TargetDefaultsRecord {
  const out: TargetDefaultsRecord = {};
  for (const entry of entries) {
    if (entry.projects !== undefined || entry.plugin !== undefined) {
      throw new Error(
        `Cannot downgrade targetDefaults to legacy record shape: entry ${JSON.stringify(
          entry
        )} uses a \`projects\`/\`plugin\` filter, which is only supported in the array shape.`
      );
    }
    const { target, executor, projects, plugin, ...rest } = entry;
    const key = target ?? executor;
    if (key === undefined) {
      throw new Error(
        `Cannot downgrade targetDefaults to legacy record shape: entry ${JSON.stringify(
          entry
        )} has neither \`target\` nor \`executor\` to use as the record key.`
      );
    }
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      throw new Error(
        `Cannot downgrade targetDefaults to legacy record shape: two entries collapse to the same key \`${key}\`. Keep the array shape so both can coexist.`
      );
    }
    const value: Partial<TargetDefaultEntry> = { ...rest };
    if (target && executor) value.executor = executor;
    out[key] = value;
  }
  return out;
}
