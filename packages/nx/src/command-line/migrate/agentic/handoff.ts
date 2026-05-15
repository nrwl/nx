import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { HandoffFile } from './types';

/** Returns the run directory for a given workspace + run id (target version). */
export function runDirPath(workspaceRoot: string, runId: string): string {
  return join(workspaceRoot, '.nx', 'agentic', runId);
}

/**
 * Wipes any prior contents for this run id and recreates an empty directory.
 *
 * Scope of the wipe is intentionally narrow (only `<run-id>/`) so that handoff
 * artifacts from prior runs targeting different versions remain on disk for
 * inspection.
 */
export function initRunDir(workspaceRoot: string, runId: string): string {
  const dir = runDirPath(workspaceRoot, runId);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

function sanitizeForFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

/**
 * Stable, filesystem-safe identifier for a migration step within a run.
 * Combines the package name and migration name so two packages can ship a
 * migration with the same name without colliding.
 */
export function stepIdFor(migration: {
  package: string;
  name: string;
}): string {
  return `${sanitizeForFilename(migration.package)}__${sanitizeForFilename(
    migration.name
  )}`;
}

export function stepHandoffPath(runDir: string, stepId: string): string {
  return join(runDir, `${stepId}.json`);
}

/**
 * Reads and validates a handoff file written by an agent. Returns `null` when
 * the file is missing, unreadable, malformed, or has an unexpected shape — the
 * caller treats `null` as the "ambiguous" outcome and asks the user how to
 * proceed.
 */
export function readHandoff(filePath: string): HandoffFile | null {
  if (!existsSync(filePath)) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    typeof (parsed as Record<string, unknown>).summary !== 'string'
  ) {
    return null;
  }
  const status = (parsed as Record<string, unknown>).status;
  if (status !== 'success' && status !== 'failed') {
    return null;
  }
  const { status: _s, summary, ...extras } = parsed as Record<string, unknown>;
  const result: HandoffFile = { status, summary: summary as string };
  if (Object.keys(extras).length > 0) {
    result.extras = extras;
  }
  return result;
}
