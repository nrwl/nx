// Internal to run/: deliberately not re-exported from ./index.
//
// Stores the payload of the `<nx_migrate_prompt>` block a recorded worker
// emits when it parks a step (a prompt to apply, or a validation pass), so a
// reconcile can re-emit the block for a session that no longer has it (after
// a compaction or a restart). Keyed by step and attempt: the name is derived,
// never recorded in run.json, and a re-armed attempt writes its own file
// instead of inheriting a stale one.

import { randomBytes } from 'crypto';
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';
import type { MigrateStepAwaitingKind } from './run-state';

const AGENT_WORK_DIR_NAME = 'agent-work';

// Both segments are Nx-issued (`step-<n>` and the attempt counter), so the
// name never carries untrusted path segments.
export function agentWorkPayloadPath(
  runDirPath: string,
  stepId: string,
  attempt: number
): string {
  return join(
    runDirPath,
    AGENT_WORK_DIR_NAME,
    `${stepId}-attempt-${attempt}.json`
  );
}

/**
 * What a stored payload must match to be trusted as the step's handed-back
 * work: the migration it was stored for, the kind of work the step is
 * awaiting, and, for a prompt, the instructions file the plan names.
 */
export interface ExpectedAgentWorkPayload {
  migrationId: string;
  kind: MigrateStepAwaitingKind;
  // The prompt path the run's plan records for the migration; a prompt
  // payload must carry exactly it, so a modified or misplaced file cannot
  // redirect the agent to different instructions than the durable run's.
  // Undefined (the plan cannot name one) rejects every prompt payload.
  // Ignored for a validation payload.
  promptPath?: string;
}

/**
 * Writes the payload atomically (temp file, then rename), so a crash mid-write
 * can only leave the stale temp file behind, never a half-written payload a
 * later read would reject. The random temp suffix matches writeRunState's
 * naming. Failures propagate: a parked step's durable contract includes the
 * stored copy (the runbook promises a lost block is re-emitted), so a caller
 * that cannot store it must fail the attempt rather than park.
 */
export function persistAgentWorkPayload(
  filePath: string,
  payload: object
): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}~${randomBytes(4).toString('hex')}`;
  writeFileSync(tmpPath, JSON.stringify(payload, null, 2));
  renameSync(tmpPath, filePath);
}

/**
 * Reads a stored payload back, or null when there is nothing usable: the file
 * is missing (the park predates this mechanism), it does not parse to a plain
 * object, or it does not match what the step awaits. The semantic checks keep
 * a truncated, modified, or misplaced file from silently becoming the
 * authoritative instruction: a prompt payload must carry exactly the plan's
 * prompt path for the named migration, a validation payload its `kind`
 * marker. The cases share a
 * remediation and are not distinguished: each caller substitutes a freshly
 * derived payload (the worker re-derives the work it is parking; the
 * reconcile dispense synthesizes one from the plan or the tree-pointing
 * validation marker, pointing at the worker's original emission only when
 * even the plan cannot name the prompt). Re-emission always re-serializes
 * the parsed value through the block writer's escaping, so a tampered file
 * cannot break the block framing.
 */
export function readAgentWorkPayload(
  filePath: string,
  expected: ExpectedAgentWorkPayload
): Record<string, unknown> | null {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const payload = parsed as Record<string, unknown>;
  if (payload.migrationId !== expected.migrationId) {
    return null;
  }
  const matchesKind =
    expected.kind === 'generator-validation'
      ? payload.kind === 'generator-validation'
      : payload.kind === undefined &&
        expected.promptPath !== undefined &&
        payload.prompt === expected.promptPath;
  return matchesKind ? payload : null;
}

/**
 * The newest prior attempt's stored payload for a step, or null when none
 * survives. A retained-generator retry re-hands the work an earlier attempt
 * stored: the payload carries the captured generator output the retry itself
 * can no longer recompute.
 *
 * The scan never goes below `fromAttempt`, the step's recorded lineage
 * boundary (the attempt its current generator marker was written on): a
 * payload from before it describes a generator run a reset-backed retry
 * discarded, and file removal alone cannot be relied on to invalidate it.
 * An undefined boundary fails closed with no lookup at all: an older nx's
 * rearm drops the field while leaving the files (the run-state format is
 * shared), so without it nothing proves a stored copy belongs to the
 * current lineage. The cost is a fallback emission where a carry may have
 * been legitimate; the alternative is re-handing reset-away evidence.
 */
export function latestStoredAgentWorkPayload(
  runDirPath: string,
  stepId: string,
  beforeAttempt: number,
  fromAttempt: number | undefined,
  expected: ExpectedAgentWorkPayload
): Record<string, unknown> | null {
  if (fromAttempt === undefined) {
    return null;
  }
  // Enumerated from disk rather than counted down from `beforeAttempt`:
  // attempts are persisted numbers, and a loop spanning their range would
  // let a tampered-but-valid counter drive that many synchronous reads.
  const candidates = storedAttemptsForStep(runDirPath, stepId)
    .filter((attempt) => attempt >= fromAttempt && attempt < beforeAttempt)
    .sort((a, b) => b - a);
  for (const attempt of candidates) {
    const payload = readAgentWorkPayload(
      agentWorkPayloadPath(runDirPath, stepId, attempt),
      expected
    );
    if (payload) {
      return payload;
    }
  }
  return null;
}

// The attempts that actually have a stored payload file for the step, read
// from the agent-work directory. A directory that cannot be read reads as
// empty: the callers' shared remediation is a freshly derived payload, and
// removal is best effort. The `-attempt-` infix keeps `step-1` from matching
// `step-12`'s files.
function storedAttemptsForStep(runDirPath: string, stepId: string): number[] {
  let entries: string[];
  try {
    entries = readdirSync(join(runDirPath, AGENT_WORK_DIR_NAME));
  } catch {
    return [];
  }
  const prefix = `${stepId}-attempt-`;
  const suffix = '.json';
  const attempts: number[] = [];
  for (const name of entries) {
    if (!name.startsWith(prefix) || !name.endsWith(suffix)) {
      continue;
    }
    const middle = name.slice(prefix.length, -suffix.length);
    if (!/^[1-9]\d*$/.test(middle)) {
      continue;
    }
    const attempt = Number(middle);
    if (Number.isSafeInteger(attempt)) {
      attempts.push(attempt);
    }
  }
  return attempts;
}

/**
 * Removes every attempt's stored payload for a step, up to and including
 * `throughAttempt`. Called once the step's outcome settles terminally (a
 * failed fold keeps the files, since a retry still carries them forward) and
 * when a reset-backed retry invalidates them. Best effort per file: the
 * callers run after the outcome or rearm is already decided, so an entry
 * that cannot be removed (a directory planted at the path, a permission
 * failure) is left to whole-run pruning rather than failing the reconcile.
 * A leftover directory can never be re-handed either way: reading it fails,
 * which the reader treats as no stored payload.
 */
export function removeAgentWorkPayloads(
  runDirPath: string,
  stepId: string,
  throughAttempt: number
): void {
  // Enumerated for the same reason as the lookup: the attempt is a persisted
  // number, and counting up to it would let a tampered-but-valid value drive
  // that many synchronous removals.
  for (const attempt of storedAttemptsForStep(runDirPath, stepId)) {
    if (attempt > throughAttempt) {
      continue;
    }
    try {
      rmSync(agentWorkPayloadPath(runDirPath, stepId, attempt), {
        force: true,
      });
    } catch {
      // See above: best effort per file.
    }
  }
}
