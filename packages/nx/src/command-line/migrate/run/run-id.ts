import { createHash, randomBytes } from 'crypto';

// Orchestrator-generated run ids always match; anything else could smuggle
// shell metacharacters into dispensed commands or a path out of the runs dir
// (the leading alphanumeric also rejects '.' and '..').
export const RUN_ID_SAFE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Creates a run id: a sortable, filesystem-safe UTC timestamp followed by a
 * random suffix (e.g. `20260715T101530-3f9a1c02`). Never derived from
 * package or Nx versions, so it stays stable across an Nx version bump
 * mid-run.
 */
export function createRunId(): string {
  return `${compactUtcTimestamp(new Date())}-${randomBytes(4).toString('hex')}`;
}

function compactUtcTimestamp(date: Date): string {
  // '2026-07-15T10:15:30.123Z' -> '20260715T101530': strips separators and
  // milliseconds so the id is filesystem-safe on every platform.
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, '');
}

/**
 * Hashes a migrations.json plan so a resumed run can detect whether the plan
 * changed since a round was recorded. `nx-console` is stripped first since
 * editors write to it without changing the plan; object keys are sorted
 * recursively (arrays keep their order) so key reordering from a different
 * JSON serializer doesn't change the hash.
 */
export function computePlanHash(
  migrationsJsonContent: string | object
): string {
  const parsed = (
    typeof migrationsJsonContent === 'string'
      ? JSON.parse(migrationsJsonContent)
      : migrationsJsonContent
  ) as Record<string, unknown>;
  const withoutNxConsole = Object.fromEntries(
    Object.entries(parsed).filter(([key]) => key !== 'nx-console')
  );
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(withoutNxConsole)))
    .digest('hex');
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}
