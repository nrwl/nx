// Internal to run/: deliberately not re-exported from ./index.
//
// Stores the `<nx_migrate_prompt>` payload a recorded worker emits when it
// parks a step, so a reconcile can re-emit the block for a session that lost
// it to a compaction or a restart. Keyed by step and attempt: the name is
// derived rather than recorded in run.json, and a re-armed attempt writes its
// own file instead of inheriting a stale one.

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

export interface ExpectedAgentWorkPayload {
  migrationId: string;
  kind: MigrateStepAwaitingKind;
  // The prompt path the run's plan records; a prompt payload must match it
  // exactly, so a modified or misplaced file cannot redirect the agent to
  // other instructions. Undefined deliberately rejects every prompt payload.
  promptPath?: string;
}

/**
 * Temp file then rename: a crash mid-write leaves only the stale temp file,
 * never a half-written payload at the real path. Failures propagate, because
 * the runbook promises a parked step's block is re-emitted, so a caller that
 * cannot store the payload must fail the attempt rather than park.
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
 * The stored payload, or null when nothing usable is on disk: the file is
 * missing (the park predates this mechanism), does not parse to a plain
 * object, or does not match what the step awaits. Null is undifferentiated on
 * purpose: every caller's remediation is the same freshly derived payload.
 * The returned object is never re-emitted as text; both re-emission sites go
 * back through the block writer's escaping, so a tampered file cannot break
 * the framing.
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
 * The newest surviving payload from a prior attempt of the step, or null. A
 * retained-generator retry re-hands it: it carries the captured generator
 * output the retry can no longer recompute.
 *
 * `fromAttempt` is the step's lineage boundary, the attempt its current
 * generator marker was written on. Anything below it describes a generator run
 * a reset-backed retry discarded, and the best-effort file removal cannot be
 * relied on to invalidate it. Undefined fails closed with no lookup at all: an
 * older nx's rearm drops the field while leaving the files (the run-state
 * format is shared), so nothing proves a stored copy belongs to the current
 * lineage. The cost is a fallback emission where a carry may have been
 * legitimate.
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

// An unreadable directory reads as empty: the lookup falls back to a freshly
// derived payload, and removal is best effort. The `-attempt-` infix keeps
// `step-1` from matching `step-12`'s files.
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
 * Best effort per file: the callers run after the outcome or rearm is already
 * decided, so an entry that cannot be removed (a permission failure, a
 * directory planted at the path) is left to whole-run pruning rather than
 * failing the reconcile. A planted directory is never re-handed either way:
 * reading it fails, which the reader treats as no stored copy.
 */
export function removeAgentWorkPayloads(
  runDirPath: string,
  stepId: string,
  throughAttempt: number
): void {
  // Enumerated for the same reason as the lookup: a tampered-but-valid attempt
  // would otherwise drive that many synchronous removals.
  for (const attempt of storedAttemptsForStep(runDirPath, stepId)) {
    if (attempt > throughAttempt) {
      continue;
    }
    try {
      rmSync(agentWorkPayloadPath(runDirPath, stepId, attempt), {
        force: true,
      });
    } catch {}
  }
}
