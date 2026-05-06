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
