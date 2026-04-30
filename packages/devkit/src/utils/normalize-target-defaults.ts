import type {
  TargetDefaultEntry,
  TargetDefaults,
  TargetDefaultsRecord,
} from 'nx/src/devkit-exports';

/**
 * Convert an nx.json `targetDefaults` value (either the legacy record shape
 * or the new array shape) into the normalized array shape.
 *
 * Record entries become `{ target: key, ...value }` preserving insertion
 * order. Executor-looking record keys (e.g. `nx:run-commands`) keep the
 * executor string in `target`; the nx-core matcher treats `target` as
 * either a target name, a glob, or an executor, so legacy semantics are
 * preserved.
 */
export function normalizeTargetDefaults(
  raw: TargetDefaults | undefined
): TargetDefaultEntry[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return [...raw];
  const out: TargetDefaultEntry[] = [];
  const record = raw as TargetDefaultsRecord;
  for (const key of Object.keys(record)) {
    const value = record[key] ?? {};
    out.push({ ...value, target: key });
  }
  return out;
}

/**
 * True when the given `targetDefaults` is already in the array shape.
 */
export function isTargetDefaultsArray(
  raw: TargetDefaults | undefined
): raw is TargetDefaultEntry[] {
  return Array.isArray(raw);
}

/**
 * Find an existing target defaults entry by the tuple
 * `(target, projects, source)`. Returns `undefined` when no such entry
 * exists. For the legacy record shape only the `target` tuple key is
 * consulted; a record never carries `projects`/`source` filters.
 */
export function findTargetDefaultEntry(
  raw: TargetDefaults | undefined,
  match: { target: string; projects?: string | string[]; source?: string }
): TargetDefaultEntry | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) {
    return raw.find(
      (e) =>
        e.target === match.target &&
        sameProjects(e.projects, match.projects) &&
        e.source === match.source
    );
  }
  if (match.projects === undefined && match.source === undefined) {
    const value = raw[match.target];
    if (!value) return undefined;
    return { ...value, target: match.target };
  }
  return undefined;
}

function sameProjects(
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
