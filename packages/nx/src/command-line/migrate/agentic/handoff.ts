import { mkdirSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { HandoffFile } from './types';

/** Returns the run directory for a given workspace + run id (target version). */
export function runDirPath(workspaceRoot: string, runId: string): string {
  return join(workspaceRoot, '.nx', 'migrate-runs', runId);
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

/**
 * Absolute path of the handoff file for a migration step within a run.
 * The package's scope (if any) becomes a real subdirectory so the package name
 * stays readable; two packages can ship a migration with the same name without
 * colliding because they land in different package subdirectories. Matches the
 * layout used by `writePromptMigrationFiles` for inlined prompt copies.
 */
export function stepHandoffPath(
  runDir: string,
  migration: { package: string; name: string }
): string {
  return join(
    runDir,
    ...migration.package.split('/'),
    `${migration.name}.json`
  );
}

/**
 * Reads and validates a handoff file written by an agent. Returns `null` when
 * the file is missing, unreadable, malformed, or has an unexpected shape — the
 * caller treats `null` as the "ambiguous" outcome and asks the user how to
 * proceed.
 */
export function readHandoff(filePath: string): HandoffFile | null {
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
  const { status, summary, ...extras } = parsed as Record<string, unknown>;
  if (status !== 'success' && status !== 'failed') {
    return null;
  }
  const result: HandoffFile = { status, summary: summary as string };
  if (Object.keys(extras).length > 0) {
    result.extras = extras;
  }
  return result;
}

/**
 * Polls for a valid handoff file. Resolves once `readHandoff` accepts the
 * file's contents. Used to detect when the agent has finished its work so the
 * orchestrator can close the agent's session without depending on the agent
 * exiting on its own.
 *
 * Rejects with the abort reason when `options.signal` is aborted.
 */
export function waitForValidHandoff(
  handoffFilePath: string,
  options: { intervalMs?: number; signal?: AbortSignal } = {}
): Promise<void> {
  const intervalMs = options.intervalMs ?? 500;
  const { signal } = options;
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('aborted'));
      return;
    }
    let timer: NodeJS.Timeout | undefined;
    const onAbort = () => {
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(signal!.reason ?? new Error('aborted'));
    };
    const tick = () => {
      if (signal?.aborted) {
        onAbort();
        return;
      }
      if (readHandoff(handoffFilePath) !== null) {
        signal?.removeEventListener('abort', onAbort);
        resolve();
        return;
      }
      timer = setTimeout(tick, intervalMs);
    };
    signal?.addEventListener('abort', onAbort);
    timer = setTimeout(tick, intervalMs);
  });
}
