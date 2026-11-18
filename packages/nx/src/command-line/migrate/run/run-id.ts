import { randomBytes } from 'crypto';

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
