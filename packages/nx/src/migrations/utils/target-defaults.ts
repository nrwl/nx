import type { TargetDefaultValue } from '../../config/nx-json';
import type { TargetConfiguration } from '../../config/workspace-json-project-json';

/**
 * The config blocks of a single `targetDefaults` value, regardless of whether
 * it is stored as the plain object form (`{ cache: true }`) or the filtered
 * array form (`[{ filter, ...config }, ...]`).
 *
 * Migrations in `packages/nx` run as part of `nx repair` against arbitrary user
 * workspaces and can't assume migration order, so they must handle both shapes.
 * Each returned block is the live entry — mutating it edits `nx.json` in place,
 * and any `filter` on an array entry is left untouched.
 */
export function targetDefaultConfigs(
  value: TargetDefaultValue | undefined
): TargetConfiguration[] {
  if (value === undefined) {
    return [];
  }
  return (Array.isArray(value) ? value : [value]) as TargetConfiguration[];
}

/**
 * The unfiltered "catch-all" config block of a `targetDefaults` value — the
 * workspace-wide baseline a migration should edit when it wants to apply a
 * default to every variant of a target (not a filtered subset). Creates the
 * block when absent and returns the value to store back, normalizing across the
 * object and array forms:
 *
 * - No value yet → a fresh object-form block.
 * - Object form → that object is the catch-all.
 * - Array form → the entry without a `filter`, appended if none exists.
 */
export function ensureCatchAllTargetDefaultConfig(
  value: TargetDefaultValue | undefined
): { config: TargetConfiguration; value: TargetDefaultValue } {
  if (value === undefined) {
    const config: TargetConfiguration = {};
    return { config, value: config };
  }
  if (Array.isArray(value)) {
    let catchAll = value.find((entry) => entry.filter === undefined);
    if (!catchAll) {
      catchAll = {};
      value.push(catchAll);
    }
    return { config: catchAll as TargetConfiguration, value };
  }
  return { config: value as TargetConfiguration, value };
}
