// Internal to run/: deliberately not re-exported from ./index.
//
// Persists each parked payload by step and attempt, so a reconcile can re-emit
// it after a compaction or restart without reusing payloads from discarded
// attempts.

import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';
import { publishFileAtomically } from './atomic-write';
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
 * Failures propagate: the runbook promises a parked step's block is
 * re-emitted, so a caller that cannot store the payload must fail the attempt
 * rather than park.
 */
export function persistAgentWorkPayload(
  filePath: string,
  payload: object
): void {
  mkdirSync(dirname(filePath), { recursive: true });
  publishFileAtomically(filePath, (tmpPath) =>
    writeFileSync(tmpPath, JSON.stringify(payload, null, 2))
  );
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
 * Returns the newest payload from the current generator lineage, or null.
 * `fromAttempt` excludes generator runs discarded by reset-backed retries; an
 * absent boundary fails closed for states written by older Nx.
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
