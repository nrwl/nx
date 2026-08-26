// The run's issue ledger. Agents supply only the handoff's `issues` /
// `issueUpdates`; ids, fingerprints, routing, claims and archiving are nx's.

import { randomBytes } from 'crypto';
import { mkdirSync, readFileSync, renameSync } from 'fs';
import { join } from 'path';
import { writeJsonFile } from '../../../utils/fileutils';
import { MIGRATE_RUNS_RELATIVE_DIR } from '../agentic/types';
import { singleLine } from '../text';
import {
  ISSUE_ID,
  issueFingerprint,
  MIGRATE_ISSUE_DISPOSITIONS,
  TERMINAL_STEP_STATUSES,
  type MigrateIssueDisposition,
  type MigrateRunIssue,
  type MigrateRunState,
  type MigrateStep,
} from './run-state';

export { issueFingerprint };
import { splitMigrationId } from './state-machine';

const ISSUES_DIR_NAME = 'issues';

// Bounds on one agent-written handoff's issue report. A report over a bound is
// rejected whole for the agent to fix, never trimmed.
const MAX_ISSUES_PER_HANDOFF = 20;
const MAX_ISSUE_UPDATES_PER_HANDOFF = 20;
const MAX_SUMMARY_CHARS = 500;
const MAX_DETAIL_CHARS = 8192;
const MAX_NOTE_CHARS = 1000;
const MAX_APPLICABLE_MIGRATIONS = 50;

// Bounds on the digest rendered into dispensed steps. Overflow here is
// truncated or counted, never rejected the way an over-bound report is.
const MAX_DIGEST_ENTRIES = 20;
const MAX_DIGEST_BYTES = 8192;
const DIGEST_SUMMARY_CHARS = 200;

// `summary` is collapsed to one line because it is rendered into dispensed step
// content; `detail` is raw and must only reach the archived JSON file.
export interface ReportedIssue {
  summary: string;
  detail?: string;
  applicableMigrations: string[] | 'unknown';
  disposition?: MigrateIssueDisposition;
}

// Only for an issue assigned to the reporting step. Updates only progress an
// issue, hence no 'recorded' target.
export interface ReportedIssueUpdate {
  id: string;
  disposition: Exclude<MigrateIssueDisposition, 'recorded'>;
  note?: string;
}

export type ParsedHandoffIssues =
  | { ok: true; issues: ReportedIssue[]; updates: ReportedIssueUpdate[] }
  | { ok: false; reason: string };

function invalid(reason: string): ParsedHandoffIssues {
  return { ok: false, reason };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Unknown keys reject rather than strip: a typoed optional ("dispositon")
// would otherwise fall back to its default and mis-route the issue silently.
function unknownKey(
  value: Record<string, unknown>,
  allowed: readonly string[]
): string | undefined {
  return Object.keys(value).find((key) => !allowed.includes(key));
}

// Collapsed and truncated because the value is agent-written and the rejection
// reason is rendered into dispensed step content.
function quoted(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const collapsed = singleLine(String(text));
  return JSON.stringify(
    collapsed.length > 100 ? `${collapsed.slice(0, 100)}...` : collapsed
  );
}

/**
 * Validates a handoff's `issues` / `issueUpdates` against the run's current
 * state. Absent fields parse as empty; any invalid entry rejects the whole
 * report with a reason the awaiting dispense hands back to the agent. Also
 * rejects unrecognized top-level handoff fields: a misspelled "issueUpates"
 * would otherwise read as an absent report and be discarded with the handoff.
 */
export function parseHandoffIssues(
  extras: Record<string, unknown> | undefined,
  state: MigrateRunState,
  reportingStep: MigrateStep
): ParsedHandoffIssues {
  if (extras !== undefined) {
    const unknown = unknownKey(extras, ['outcome', 'issues', 'issueUpdates']);
    if (unknown !== undefined) {
      return invalid(
        `the handoff has an unrecognized field ${quoted(
          unknown
        )}; the fields accepted next to "status" and "summary" are "outcome", "issues" and "issueUpdates"`
      );
    }
    if (extras['outcome'] !== undefined && extras['outcome'] !== 'skipped') {
      return invalid(
        `the handoff has an unrecognized "outcome" value ${quoted(
          extras['outcome']
        )}; the only accepted value is "skipped"`
      );
    }
  }
  const rawIssues = extras?.['issues'];
  const rawUpdates = extras?.['issueUpdates'];
  const issues: ReportedIssue[] = [];
  const updates: ReportedIssueUpdate[] = [];
  if (rawIssues !== undefined) {
    if (!Array.isArray(rawIssues)) {
      return invalid(`the "issues" field must be an array`);
    }
    if (rawIssues.length > MAX_ISSUES_PER_HANDOFF) {
      return invalid(
        `the "issues" field lists ${rawIssues.length} entries; at most ${MAX_ISSUES_PER_HANDOFF} are accepted per handoff`
      );
    }
    const seenFingerprints = new Set<string>();
    for (let i = 0; i < rawIssues.length; i++) {
      const parsed = parseReportedIssue(rawIssues[i], i, state);
      if (typeof parsed === 'string') return invalid(parsed);
      // Rejected rather than folded: array order would decide which disposition
      // lands, since the second entry folds into the first's just-minted one.
      const fingerprint = issueFingerprint(parsed.summary);
      if (seenFingerprints.has(fingerprint)) {
        return invalid(
          `"issues"[${i}] repeats an earlier entry's summary; report each problem once, with its final disposition`
        );
      }
      seenFingerprints.add(fingerprint);
      issues.push(parsed);
    }
  }
  if (rawUpdates !== undefined) {
    if (!Array.isArray(rawUpdates)) {
      return invalid(`the "issueUpdates" field must be an array`);
    }
    if (rawUpdates.length > MAX_ISSUE_UPDATES_PER_HANDOFF) {
      return invalid(
        `the "issueUpdates" field lists ${rawUpdates.length} entries; at most ${MAX_ISSUE_UPDATES_PER_HANDOFF} are accepted per handoff`
      );
    }
    const seenIds = new Set<string>();
    for (let i = 0; i < rawUpdates.length; i++) {
      const parsed = parseIssueUpdate(rawUpdates[i], i, state, reportingStep);
      if (typeof parsed === 'string') return invalid(parsed);
      // Rejected rather than applied in order: the ledger records only the final
      // disposition, so sequence would carry meaning nothing persists.
      if (seenIds.has(parsed.id)) {
        return invalid(
          `"issueUpdates" lists ${parsed.id} more than once; report one final disposition per issue`
        );
      }
      seenIds.add(parsed.id);
      updates.push(parsed);
    }
  }
  // Rejected rather than ordered: applyReportedIssues applies reports before
  // updates, so the fixed order would silently decide the final disposition.
  if (issues.length > 0 && updates.length > 0) {
    const updatedIds = new Set(updates.map((u) => u.id));
    for (let i = 0; i < issues.length; i++) {
      const existing = (state.issues ?? []).find(
        (s) => s.fingerprint === issueFingerprint(issues[i].summary)
      );
      if (existing !== undefined && updatedIds.has(existing.id)) {
        return invalid(
          `"issues"[${i}] describes ${existing.id}, which "issueUpdates" also references; report the problem or update the assignment, not both`
        );
      }
    }
  }
  return { ok: true, issues, updates };
}

function parseReportedIssue(
  value: unknown,
  index: number,
  state: MigrateRunState
): string | ReportedIssue {
  const label = `"issues"[${index}]`;
  if (!isPlainObject(value)) {
    return `${label} must be an object`;
  }
  const unknown = unknownKey(value, [
    'summary',
    'detail',
    'applicableMigrations',
    'disposition',
  ]);
  if (unknown !== undefined) {
    return `${label} has an unrecognized field ${quoted(
      unknown
    )}; allowed fields are "summary", "detail", "applicableMigrations" and "disposition"`;
  }
  // Validated after singleLine: U+0085 is a terminator to singleLine but not
  // to trim, so a raw check would accept a summary that normalizes empty.
  const summary =
    typeof value.summary === 'string'
      ? singleLine(value.summary).trim()
      : undefined;
  if (
    summary === undefined ||
    summary.length === 0 ||
    summary.length > MAX_SUMMARY_CHARS
  ) {
    return `${label} needs a non-empty "summary" string of at most ${MAX_SUMMARY_CHARS} characters`;
  }
  const detail = value.detail;
  if (
    detail !== undefined &&
    (typeof detail !== 'string' || detail.length > MAX_DETAIL_CHARS)
  ) {
    return `${label} has a "detail" that is not a string of at most ${MAX_DETAIL_CHARS} characters`;
  }
  const applicable = value.applicableMigrations;
  if (applicable !== 'unknown') {
    if (
      !Array.isArray(applicable) ||
      applicable.length === 0 ||
      applicable.length > MAX_APPLICABLE_MIGRATIONS
    ) {
      return `${label} needs an "applicableMigrations" that is either the string "unknown" or an array of 1 to ${MAX_APPLICABLE_MIGRATIONS} migration identifiers`;
    }
    for (const identifier of applicable) {
      if (typeof identifier !== 'string') {
        return `${label}.applicableMigrations entries must be strings`;
      }
      if (mappedStepIds(identifier, state).length === 0) {
        return `${label}.applicableMigrations names ${quoted(
          identifier
        )}, which is not in this run's plan; use an exact "<package>:<name>" id or a bare package name from the plan, or "unknown"`;
      }
    }
  }
  const disposition = value.disposition;
  if (
    disposition !== undefined &&
    !(MIGRATE_ISSUE_DISPOSITIONS as readonly unknown[]).includes(disposition)
  ) {
    return `${label} has a "disposition" that is not one of ${MIGRATE_ISSUE_DISPOSITIONS.map(
      (d) => `"${d}"`
    ).join(', ')}`;
  }
  return {
    summary,
    ...(detail !== undefined ? { detail: detail as string } : {}),
    applicableMigrations:
      applicable === 'unknown' ? 'unknown' : (applicable as string[]),
    ...(disposition !== undefined
      ? { disposition: disposition as MigrateIssueDisposition }
      : {}),
  };
}

function parseIssueUpdate(
  value: unknown,
  index: number,
  state: MigrateRunState,
  reportingStep: MigrateStep
): string | ReportedIssueUpdate {
  const label = `"issueUpdates"[${index}]`;
  if (!isPlainObject(value)) {
    return `${label} must be an object`;
  }
  const unknown = unknownKey(value, ['id', 'disposition', 'note']);
  if (unknown !== undefined) {
    return `${label} has an unrecognized field ${quoted(
      unknown
    )}; allowed fields are "id", "disposition" and "note"`;
  }
  const issue =
    typeof value.id === 'string'
      ? (state.issues ?? []).find((i) => i.id === value.id)
      : undefined;
  if (!issue) {
    return `${label} references ${quoted(
      value.id
    )}, which is not an issue nx has recorded for this run`;
  }
  if (issue.claimedByStepId !== reportingStep.id) {
    return `${label} references ${issue.id}, which is not assigned to this step; only issues the dispensed digest marks assigned to the current step can be updated`;
  }
  const disposition = value.disposition;
  if (disposition !== 'resolved' && disposition !== 'deferred-final') {
    return `${label} needs a "disposition" of "resolved" or "deferred-final"`;
  }
  const note = value.note;
  if (
    note !== undefined &&
    (typeof note !== 'string' || note.length > MAX_NOTE_CHARS)
  ) {
    return `${label} has a "note" that is not a string of at most ${MAX_NOTE_CHARS} characters`;
  }
  return {
    id: issue.id,
    disposition,
    ...(note !== undefined ? { note: note as string } : {}),
  };
}

// A bare identifier matches the whole package name, scoped names included:
// nothing splits on '/'. Step ids are unique, so the result needs no dedup.
function mappedStepIds(identifier: string, state: MigrateRunState): string[] {
  if (identifier.includes(':')) {
    return state.steps
      .filter((s) => s.migrationId === identifier)
      .map((s) => s.id);
  }
  return state.steps
    .filter((s) => splitMigrationId(s.migrationId).package === identifier)
    .map((s) => s.id);
}

// Archives the note, detail and refined applicability the ledger has no field
// for. `disposition` admits 'recorded' (nx's own reopens and revivals).
export interface IssueArchiveUpdate {
  issueId: string;
  stepId: string;
  disposition: MigrateIssueDisposition;
  note?: string;
  detail?: string;
  applicableMigrations?: string[];
}

export interface IssueApplication {
  state: MigrateRunState;
  newIssues: { entry: MigrateRunIssue; report: ReportedIssue }[];
  updates: IssueArchiveUpdate[];
}

/**
 * Pure. Must run on state read fresh inside the fold's locked write, or ids
 * collide and the claim checks test state that is no longer on disk.
 */
export function applyReportedIssues(
  state: MigrateRunState,
  reportingStep: MigrateStep,
  issues: ReportedIssue[],
  updates: ReportedIssueUpdate[]
): IssueApplication {
  const ledger = [...(state.issues ?? [])];
  const newIssues: IssueApplication['newIssues'] = [];
  const archiveUpdates: IssueArchiveUpdate[] = [];
  // Allocate past the highest existing suffix, not from the ledger length: the
  // reader accepts sparse ids, and a re-minted id would overwrite another
  // issue's archive file. BigInt because a number suffix stalls at 2^53.
  let nextIdNumber =
    ledger.reduce((max, i) => {
      const suffix = BigInt(i.id.slice('issue-'.length));
      return suffix > max ? suffix : max;
    }, 0n) + 1n;
  for (const report of issues) {
    const fingerprint = issueFingerprint(report.summary);
    const existingIndex = ledger.findIndex(
      (i) => i.fingerprint === fingerprint
    );
    if (existingIndex !== -1) {
      const existing = ledger[existingIndex];
      const outcome = applyDuplicateReport(
        existing,
        report,
        reportingStep,
        state
      );
      if (outcome.entry !== existing) {
        ledger[existingIndex] = outcome.entry;
      }
      if (outcome.archive) {
        archiveUpdates.push({
          issueId: existing.id,
          stepId: reportingStep.id,
          disposition: outcome.entry.disposition,
          ...(report.applicableMigrations !== 'unknown'
            ? { applicableMigrations: report.applicableMigrations }
            : {}),
          ...(report.detail !== undefined ? { detail: report.detail } : {}),
        });
      }
      continue;
    }
    const applicableStepIds =
      report.applicableMigrations === 'unknown'
        ? 'unknown'
        : mapApplicableSteps(report.applicableMigrations, state);
    const disposition = resolveDisposition(report, applicableStepIds, state);
    // Reachable only at the reader's 18-digit bound. Throwing hands the caller's
    // archive error handling the failure instead of writing a state it rejects.
    const id = `issue-${nextIdNumber++}`;
    if (!ISSUE_ID.test(id)) {
      throw new Error(
        `the issue ledger cannot allocate "${id}": the id suffix is out of range`
      );
    }
    const entry: MigrateRunIssue = {
      id,
      fingerprint,
      summary: report.summary,
      reportedByStepId: reportingStep.id,
      applicableStepIds,
      disposition,
      ...(disposition === 'resolved'
        ? {
            resolvedByStepId: reportingStep.id,
            resolvedAtCommitCount: state.commits.length,
          }
        : {}),
    };
    ledger.push(entry);
    newIssues.push({ entry, report });
  }
  for (const update of updates) {
    const index = ledger.findIndex((i) => i.id === update.id);
    // Ids were validated against this same state by the caller.
    if (index === -1) continue;
    const existing = ledger[index];
    if (existing.disposition !== update.disposition) {
      // The claim and the resolution credit both die with the move: only 'recorded'
      // issues carry an assignment, and the stamp belongs to this resolution alone.
      const {
        resolvedByStepId: _dropped,
        resolvedAtCommitCount: _fence,
        claimedByStepId: _released,
        ...rest
      } = existing;
      ledger[index] =
        update.disposition === 'resolved'
          ? {
              ...rest,
              disposition: 'resolved',
              resolvedByStepId: reportingStep.id,
              resolvedAtCommitCount: state.commits.length,
            }
          : { ...rest, disposition: update.disposition };
    }
    // Archived even when the disposition did not move: the note may carry
    // context the ledger has no field for.
    archiveUpdates.push({
      issueId: update.id,
      stepId: reportingStep.id,
      disposition: update.disposition,
      ...(update.note !== undefined ? { note: update.note } : {}),
    });
  }
  return {
    state: { ...state, issues: ledger },
    newIssues,
    updates: archiveUpdates,
  };
}

type ReportIntent = 'resolved' | 'deferred-final' | 'unresolved';

function reportIntent(report: ReportedIssue): ReportIntent {
  switch (report.disposition) {
    case 'resolved':
      return 'resolved';
    case 'deferred-final':
      return 'deferred-final';
    case 'recorded':
    case undefined:
      return 'unresolved';
    default:
      return unreachable(report.disposition);
  }
}

/**
 * Folds a duplicate report into its existing entry, one cell per (disposition x
 * intent) pair. A recorded entry another live step holds blocks a resolve or
 * defer down to a refinement: an assignment made in that step's digest cannot
 * be revoked from outside it. Every cell that changed the entry, and every
 * report carrying detail, must archive: the fold removes the handoff, so
 * unarchived detail is lost.
 */
function applyDuplicateReport(
  existing: MigrateRunIssue,
  report: ReportedIssue,
  reportingStep: MigrateStep,
  state: MigrateRunState
): { entry: MigrateRunIssue; archive: boolean } {
  const intent = reportIntent(report);
  const merged = mergedApplicableStepIds(existing, report, state);
  // Set inclusion, not a length compare: a corrupt entry with duplicate scope
  // ids would otherwise read the normalizing merge as new routing.
  const addedStepIds = !Array.isArray(merged)
    ? []
    : !Array.isArray(existing.applicableStepIds)
      ? merged
      : merged.filter(
          (id) => !(existing.applicableStepIds as string[]).includes(id)
        );
  const widened = addedStepIds.length > 0;
  // Only a live assignment blocks: a terminal claimant can never hand back
  // another handoff, so its claim is stale bookkeeping, not ownership.
  const claimant =
    existing.disposition === 'recorded' &&
    existing.claimedByStepId !== undefined
      ? state.steps.find((s) => s.id === existing.claimedByStepId)
      : undefined;
  const blocked =
    claimant !== undefined &&
    claimant.id !== reportingStep.id &&
    !TERMINAL_STEP_STATUSES.has(claimant.status);
  const refine = (): { entry: MigrateRunIssue; archive: boolean } => ({
    entry: widened ? { ...existing, applicableStepIds: merged } : existing,
    archive: widened || report.detail !== undefined,
  });
  const transition = (
    disposition: MigrateIssueDisposition
  ): { entry: MigrateRunIssue; archive: boolean } => {
    const {
      resolvedByStepId: _credit,
      resolvedAtCommitCount: _fence,
      claimedByStepId: _claim,
      ...rest
    } = existing;
    return {
      entry: {
        ...rest,
        applicableStepIds: merged,
        disposition,
        ...(disposition === 'resolved'
          ? {
              resolvedByStepId: reportingStep.id,
              resolvedAtCommitCount: state.commits.length,
            }
          : {}),
      },
      archive: true,
    };
  };
  switch (existing.disposition) {
    case 'recorded':
      switch (intent) {
        case 'resolved':
          return blocked ? refine() : transition('resolved');
        case 'deferred-final':
          return blocked ? refine() : transition('deferred-final');
        case 'unresolved':
          return refine();
        default:
          return unreachable(intent);
      }
    case 'resolved':
      // A duplicate report over a resolved entry is a recurrence: resolved issues
      // leave the digest, so the reporter hit the problem again, not echoed it.
      switch (intent) {
        case 'resolved':
          // Not a no-op: the recurrence re-credits the new resolver and re-stamps.
          return transition('resolved');
        case 'deferred-final':
        case 'unresolved':
          return transition(resolveDisposition(report, merged, state));
        default:
          return unreachable(intent);
      }
    case 'deferred-final':
      switch (intent) {
        case 'resolved':
          // Deferred entries have no assignment, so any step that actually
          // fixed the problem may resolve them.
          return transition('resolved');
        case 'deferred-final':
          return refine();
        case 'unresolved':
          // Revive only on newly ADDED routing that can still claim it: deferred entries
          // stay digest-visible, so a repeat with no new scope may just be echoing one,
          // and testing `merged` instead would let a route to finished work reopen it.
          return hasClaimableStep(addedStepIds, state)
            ? transition('recorded')
            : refine();
        default:
          return unreachable(intent);
      }
    default:
      return unreachable(existing.disposition);
  }
}

function unreachable(value: never): never {
  throw new Error(`unexpected value: ${JSON.stringify(value)}`);
}

// A commit carries the resolution only if it names the resolving step AND
// postdates the stamp: the same step's earlier commits must not vouch for it.
function resolutionCarried(
  state: MigrateRunState,
  issue: MigrateRunIssue
): boolean {
  return state.commits
    .slice(issue.resolvedAtCommitCount ?? 0)
    .some(
      (c) =>
        c.kind === 'landed' &&
        (c.issueIds ?? []).includes(issue.id) &&
        c.stepIds.includes(issue.resolvedByStepId)
    );
}

/**
 * The issue ids a landed commit naming `stepIds` carries. Attribution rides on
 * the persisted `resolvedByStepId`, so a resolution whose own commit attempt
 * failed still reaches the later commit that absorbs that step's tree.
 */
export function issueIdsForCommit(
  state: MigrateRunState,
  stepIds: string[]
): string[] {
  const issues = state.issues;
  if (!issues) return [];
  return issues
    .filter(
      (i) =>
        i.disposition === 'resolved' &&
        i.resolvedByStepId !== undefined &&
        stepIds.includes(i.resolvedByStepId) &&
        !resolutionCarried(state, i)
    )
    .map((i) => i.id);
}

/**
 * Reverts the resolutions a step's discarded attempt claimed and releases its
 * issue assignments. A retry-clean resets the tree, so a reported fix is gone
 * unless a landed commit carries it; leaving the entry resolved would attach
 * its id to whatever the retry lands next. The claim goes too: the retry may
 * never park for agent work, so a kept assignment would render "assigned to
 * this step" with no handoff to answer through. Pure; the returned updates are
 * the archive trail, which claim releases do not join.
 */
export function reopenResolutionsForStep(
  state: MigrateRunState,
  stepId: string
): { state: MigrateRunState; updates: IssueArchiveUpdate[] } {
  const issues = state.issues;
  if (!issues) return { state, updates: [] };
  const updates: IssueArchiveUpdate[] = [];
  let changed = false;
  const next = issues.map((issue) => {
    if (
      issue.disposition === 'resolved' &&
      issue.resolvedByStepId === stepId &&
      !resolutionCarried(state, issue)
    ) {
      const {
        resolvedByStepId: _dropped,
        resolvedAtCommitCount: _fence,
        claimedByStepId: _stale,
        ...rest
      } = issue;
      const disposition: MigrateIssueDisposition = hasClaimableStep(
        issue.applicableStepIds,
        state
      )
        ? 'recorded'
        : 'deferred-final';
      updates.push({ issueId: issue.id, stepId, disposition });
      changed = true;
      return { ...rest, disposition };
    }
    if (issue.claimedByStepId === stepId) {
      const { claimedByStepId: _released, ...rest } = issue;
      changed = true;
      return rest;
    }
    return issue;
  });
  return changed
    ? { state: { ...state, issues: next }, updates }
    : { state, updates };
}

// Unknown applicability is deferred, not recorded: nothing can claim it, so a
// 'recorded' entry would sit waiting for an assignment that never comes.
function resolveDisposition(
  report: ReportedIssue,
  applicableStepIds: string[] | 'unknown',
  state: MigrateRunState
): MigrateIssueDisposition {
  const disposition =
    report.disposition ??
    (applicableStepIds === 'unknown' ? 'deferred-final' : 'recorded');
  if (disposition !== 'recorded') return disposition;
  return hasClaimableStep(applicableStepIds, state)
    ? 'recorded'
    : 'deferred-final';
}

function mergedApplicableStepIds(
  existing: MigrateRunIssue,
  report: ReportedIssue,
  state: MigrateRunState
): string[] | 'unknown' {
  if (report.applicableMigrations === 'unknown') {
    return existing.applicableStepIds;
  }
  const combined = new Set([
    ...(Array.isArray(existing.applicableStepIds)
      ? existing.applicableStepIds
      : []),
    ...mapApplicableSteps(report.applicableMigrations, state),
  ]);
  return state.steps.map((s) => s.id).filter((id) => combined.has(id));
}

// Non-terminal is the boundary, not 'pending': a just-failed step can be
// re-armed, and its retry's dispense claims recorded issues.
function hasClaimableStep(
  applicableStepIds: string[] | 'unknown',
  state: MigrateRunState
): boolean {
  if (applicableStepIds === 'unknown') return false;
  return applicableStepIds.some((id) => {
    const status = state.steps.find((s) => s.id === id)?.status;
    return status !== undefined && !TERMINAL_STEP_STATUSES.has(status);
  });
}

function mapApplicableSteps(
  identifiers: string[],
  state: MigrateRunState
): string[] {
  const mapped = new Set<string>();
  for (const identifier of identifiers) {
    for (const stepId of mappedStepIds(identifier, state)) {
      mapped.add(stepId);
    }
  }
  return state.steps.map((s) => s.id).filter((id) => mapped.has(id));
}

/**
 * Claims the still-recorded issues applicable to the step being dispensed, up
 * to what the digest can publish. Must run inside the dispense's locked write:
 * serial dispensing is what makes reassignment to the next applicable step
 * deterministic when an earlier one left the issue unresolved.
 */
export function claimIssuesForStep(
  state: MigrateRunState,
  stepId: string
): MigrateRunState {
  const issues = state.issues;
  if (!issues) return state;
  // Claims are capped to what the digest can publish: an unlisted assignment is
  // invisible to its assignee, since issueUpdates may only name digest-marked
  // issues. This walk must mirror the renderer's assigned-first order and caps.
  let count = 0;
  let bytes = 0;
  let changed = false;
  const next = issues.map((issue) => {
    if (
      issue.disposition !== 'recorded' ||
      !Array.isArray(issue.applicableStepIds) ||
      !issue.applicableStepIds.includes(stepId)
    ) {
      return issue;
    }
    const entryBytes = Buffer.byteLength(
      digestEntry(issue, 'assigned to this step'),
      'utf8'
    );
    if (count < MAX_DIGEST_ENTRIES && bytes + entryBytes <= MAX_DIGEST_BYTES) {
      count++;
      bytes += entryBytes;
      if (issue.claimedByStepId === stepId) return issue;
      changed = true;
      return { ...issue, claimedByStepId: stepId };
    }
    if (issue.claimedByStepId === stepId) {
      changed = true;
      const { claimedByStepId: _dropped, ...rest } = issue;
      return rest;
    }
    return issue;
  });
  return changed ? { ...state, issues: next } : state;
}

/**
 * Demotes recorded issues no remaining step can claim, and releases claims
 * whose assignee turned terminal. Report-time deferral only saw the run as it
 * stood then, so a step turning terminal later without resolving its claims
 * leaves entries the routing contract calls claimable, or a dead assignment
 * posing as ownership. Must run before anything renders. Not archived: this is
 * the run's own progression, not a step-authored change.
 */
export function settleUnclaimableIssues(
  state: MigrateRunState
): MigrateRunState {
  const issues = state.issues;
  if (!issues) return state;
  let changed = false;
  const next = issues.map((issue) => {
    if (issue.disposition !== 'recorded') return issue;
    if (!hasClaimableStep(issue.applicableStepIds, state)) {
      changed = true;
      // The claim goes with the demotion: a deferred issue is assigned
      // nowhere, and the state reader rejects a claim on a non-recorded issue.
      const { claimedByStepId: _dropped, ...rest } = issue;
      return { ...rest, disposition: 'deferred-final' as const };
    }
    // A terminal assignee can never hand back another handoff, so its claim
    // blocks nothing and would read as active ownership.
    const claimant =
      issue.claimedByStepId !== undefined
        ? state.steps.find((s) => s.id === issue.claimedByStepId)
        : undefined;
    if (claimant !== undefined && TERMINAL_STEP_STATUSES.has(claimant.status)) {
      changed = true;
      const { claimedByStepId: _released, ...rest } = issue;
      return rest;
    }
    return issue;
  });
  return changed ? { ...state, issues: next } : state;
}

function issuesDirRef(runId: string): string {
  return `${MIGRATE_RUNS_RELATIVE_DIR}/${runId}/${ISSUES_DIR_NAME}/`;
}

/**
 * The bounded "Known issues" digest a work dispense carries. The assigned-first
 * order and caps are load-bearing: claimIssuesForStep mirrors them so every
 * claim it keeps is guaranteed a line here.
 */
export function renderIssueDigestLines(
  state: MigrateRunState,
  currentStepId: string,
  runId: string
): string[] {
  const unresolved = (state.issues ?? []).filter(
    (i) => i.disposition !== 'resolved'
  );
  if (unresolved.length === 0) return [];
  const assigned = unresolved.filter(
    (i) => i.disposition === 'recorded' && i.claimedByStepId === currentStepId
  );
  const entries = [
    ...assigned.map((i) => digestEntry(i, 'assigned to this step')),
    ...unresolved
      .filter(
        (i) =>
          i.disposition === 'recorded' && i.claimedByStepId !== currentStepId
      )
      .map((i) => digestEntry(i, 'recorded')),
    ...unresolved
      .filter((i) => i.disposition === 'deferred-final')
      .map((i) => digestEntry(i, 'deferred past the migration steps')),
  ];
  const lines = [
    ``,
    `Known issues reported earlier in this run (details under ${issuesDirRef(
      runId
    )}):`,
    ...boundedEntryLines(entries, runId),
  ];
  if (assigned.length > 0) {
    lines.push(
      `Fix the issues assigned to this step within its scope where you can, and report each result in the handoff's "issueUpdates" field.`
    );
  }
  return lines;
}

export function renderUnresolvedIssueLines(
  state: MigrateRunState,
  runId: string
): string[] {
  const unresolved = (state.issues ?? []).filter(
    (i) => i.disposition !== 'resolved'
  );
  if (unresolved.length === 0) return [];
  const entries = [
    ...unresolved
      .filter((i) => i.disposition === 'recorded')
      .map((i) => digestEntry(i, 'recorded')),
    ...unresolved
      .filter((i) => i.disposition === 'deferred-final')
      .map((i) => digestEntry(i, 'deferred past the migration steps')),
  ];
  const noun = unresolved.length === 1 ? 'issue' : 'issues';
  return [
    `${unresolved.length} reported ${noun} remain${
      unresolved.length === 1 ? 's' : ''
    } unresolved (details under ${issuesDirRef(runId)}):`,
    ...boundedEntryLines(entries, runId),
  ];
}

function digestEntry(issue: MigrateRunIssue, label: string): string {
  const summary =
    issue.summary.length > DIGEST_SUMMARY_CHARS
      ? `${issue.summary.slice(0, DIGEST_SUMMARY_CHARS)}...`
      : issue.summary;
  return `  - ${issue.id} (${label}): ${summary}`;
}

// Breaks at the first entry over a cap rather than skipping it: the listed set
// must stay a prefix, or the assigned-first ordering would not survive.
function boundedEntryLines(entries: string[], runId: string): string[] {
  const lines: string[] = [];
  let bytes = 0;
  for (const entry of entries) {
    const entryBytes = Buffer.byteLength(entry, 'utf8');
    if (
      lines.length >= MAX_DIGEST_ENTRIES ||
      bytes + entryBytes > MAX_DIGEST_BYTES
    ) {
      break;
    }
    lines.push(entry);
    bytes += entryBytes;
  }
  const omitted = entries.length - lines.length;
  if (omitted > 0) {
    lines.push(
      `  ...and ${omitted} more not listed; see ${issuesDirRef(runId)}.`
    );
  }
  return lines;
}

function issuesDir(runDirPath: string): string {
  return join(runDirPath, ISSUES_DIR_NAME);
}

// `issueId` is nx-assigned (`issue-<n>`), so the join cannot leave the
// directory.
export function issueArchivePath(runDirPath: string, issueId: string): string {
  return join(issuesDir(runDirPath), `${issueId}.json`);
}

/**
 * Archives an application's new issues (with the detail the ledger does not
 * carry) and appends its updates to the archived files. Failures propagate;
 * the caller then keeps the handoff file as the fallback detail store.
 * `reconstructedIds` is filled as it goes rather than returned alone: a retry
 * finds a rebuilt shell healthy, so a throw-interrupted pass is the only
 * chance to warn that an archive was lost.
 */
export function archiveIssues(
  runDirPath: string,
  application: IssueApplication,
  reconstructedIds: string[] = []
): string[] {
  for (const { entry, report } of application.newIssues) {
    const record = { ...newIssueArchiveRecord(entry, report), updates: [] };
    writeIssueArchive(runDirPath, entry.id, record);
  }
  // One append per issue, so an application's whole batch lands in a single
  // atomic write a crash cannot split.
  const batches = batchUpdatesByIssue(application.updates);
  for (const [issueId, batch] of batches) {
    const reconstructed = appendIssueUpdatesToArchive(
      runDirPath,
      issueId,
      batch,
      application.state
    );
    if (reconstructed) {
      reconstructedIds.push(issueId);
    }
  }
  return reconstructedIds;
}

/**
 * Whether every archive this application touches is on disk and still holds
 * what phase 1 wrote: a new issue's file must equal the first-report record
 * with an empty update list, and an updated issue's records must END with this
 * application's batch, matching the append path's whole-suffix replay rule. A
 * shell rebuilt for a lost archive carries the same identity values, so it
 * verifies like any other phase-1 output. The fold's phase-2 re-archive checks
 * this before tolerating a write failure.
 */
export function applicationArchivesIntact(
  runDirPath: string,
  application: IssueApplication
): boolean {
  const readRaw = (issueId: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(
        readFileSync(issueArchivePath(runDirPath, issueId), 'utf-8')
      );
      return isPlainObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };
  for (const { entry, report } of application.newIssues) {
    const archive = readRaw(entry.id);
    if (
      archive === null ||
      !isHealthyArchive(archive, entry.id, application.state)
    ) {
      return false;
    }
    const expected = newIssueArchiveRecord(entry, report);
    const survives = NEW_ISSUE_ARCHIVE_KEYS.every(
      (key) => JSON.stringify(archive[key]) === JSON.stringify(expected[key])
    );
    if (
      !survives ||
      !Array.isArray(archive.updates) ||
      archive.updates.length > 0
    ) {
      return false;
    }
  }
  for (const [issueId, batch] of batchUpdatesByIssue(application.updates)) {
    const archive = readRaw(issueId);
    if (
      archive === null ||
      !isHealthyArchive(archive, issueId, application.state)
    ) {
      return false;
    }
    const records = Array.isArray(archive.updates) ? archive.updates : [];
    const expectedBatch = batch.map(archiveUpdateRecord);
    const tail = records.slice(records.length - expectedBatch.length);
    if (JSON.stringify(tail) !== JSON.stringify(expectedBatch)) {
      return false;
    }
  }
  return true;
}

const NEW_ISSUE_ARCHIVE_KEYS = [
  'id',
  'fingerprint',
  'summary',
  'reportedByStepId',
  'applicableMigrations',
  'reportedDisposition',
  'disposition',
  'detail',
] as const;

// Shared by the write path and the intactness check so their shapes cannot
// drift.
function newIssueArchiveRecord(
  entry: MigrateRunIssue,
  report: ReportedIssue
): Record<string, unknown> {
  return {
    id: entry.id,
    fingerprint: entry.fingerprint,
    summary: entry.summary,
    reportedByStepId: entry.reportedByStepId,
    applicableMigrations: report.applicableMigrations,
    // Both dispositions: the ladder may start the entry somewhere other than what
    // the reporter asked for, and the file keeps both.
    ...(report.disposition !== undefined
      ? { reportedDisposition: report.disposition }
      : {}),
    disposition: entry.disposition,
    ...(report.detail !== undefined ? { detail: report.detail } : {}),
  };
}

function batchUpdatesByIssue(
  updates: IssueArchiveUpdate[]
): Map<string, IssueArchiveUpdate[]> {
  const batches = new Map<string, IssueArchiveUpdate[]>();
  for (const update of updates) {
    const batch = batches.get(update.issueId) ?? [];
    batch.push(update);
    batches.set(update.issueId, batch);
  }
  return batches;
}

// Shared by the append path and the intactness check so their shapes cannot
// drift.
function archiveUpdateRecord(update: IssueArchiveUpdate): object {
  return {
    stepId: update.stepId,
    disposition: update.disposition,
    ...(update.note !== undefined ? { note: update.note } : {}),
    ...(update.detail !== undefined ? { detail: update.detail } : {}),
    ...(update.applicableMigrations !== undefined
      ? { applicableMigrations: update.applicableMigrations }
      : {}),
  };
}

// True when the archive had to be rebuilt (missing or corrupt).
function appendIssueUpdatesToArchive(
  runDirPath: string,
  issueId: string,
  batch: IssueArchiveUpdate[],
  state: MigrateRunState
): boolean {
  const filePath = issueArchivePath(runDirPath, issueId);
  // Missing or corrupt archives are rebuilt from run state, which stays
  // authoritative for dispositions. Any other read error rethrows rather than
  // overwrite: it may hide an intact file, the only copy of the issue's detail.
  let existing: Record<string, unknown>;
  let reconstructed = false;
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
    if (isHealthyArchive(parsed, issueId, state)) {
      existing = parsed;
    } else {
      existing = reconstructedArchiveShell(issueId, state);
      reconstructed = true;
    }
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code !== undefined && code !== 'ENOENT') {
      throw e;
    }
    existing = reconstructedArchiveShell(issueId, state);
    reconstructed = true;
  }
  const updates = Array.isArray(existing.updates) ? existing.updates : [];
  const records = batch.map(archiveUpdateRecord);
  // Skip a batch the archive already ends with: a crash between these writes and
  // the fold's state write replays the same application. Compared as a whole
  // suffix, since one application can legally append several records per issue.
  const tail = updates.slice(updates.length - records.length);
  if (
    tail.length === records.length &&
    JSON.stringify(tail) === JSON.stringify(records)
  ) {
    return reconstructed;
  }
  writeIssueArchive(runDirPath, issueId, {
    ...existing,
    updates: [...updates, ...records],
  });
  return reconstructed;
}

// Identity only: id, fingerprint, summary and reporter must match the ledger
// entry. Everything else is informational and deliberately unpoliced, since
// run.json decides behavior and authenticating archive history is a non-goal.
// A hollow or mismatched file rebuilds, rather than hiding the loss.
function isHealthyArchive(
  value: unknown,
  issueId: string,
  state: MigrateRunState
): value is Record<string, unknown> {
  if (!isPlainObject(value)) return false;
  if (value.id !== issueId) return false;
  const entry = (state.issues ?? []).find((i) => i.id === issueId);
  if (entry !== undefined) {
    return (
      value.fingerprint === entry.fingerprint &&
      value.summary === entry.summary &&
      value.reportedByStepId === entry.reportedByStepId
    );
  }
  if (
    typeof value.fingerprint === 'string' &&
    typeof value.summary === 'string' &&
    typeof value.reportedByStepId === 'string'
  ) {
    return true;
  }
  return value.reconstructed === true;
}

// The originally reported detail is gone with the file; `reconstructed` keeps
// that loss visible to whoever the digest points here.
function reconstructedArchiveShell(
  issueId: string,
  state: MigrateRunState
): Record<string, unknown> {
  const entry = state.issues?.find((i) => i.id === issueId);
  if (!entry) return { id: issueId, reconstructed: true };
  return {
    id: entry.id,
    fingerprint: entry.fingerprint,
    summary: entry.summary,
    reportedByStepId: entry.reportedByStepId,
    applicableMigrations: Array.isArray(entry.applicableStepIds)
      ? entry.applicableStepIds.map(
          (stepId) =>
            state.steps.find((s) => s.id === stepId)?.migrationId ?? stepId
        )
      : 'unknown',
    reconstructed: true,
  };
}

// Atomic like every other run artifact write: a crash can only leave a stale
// temp file, never a partial archive.
function writeIssueArchive(
  runDirPath: string,
  issueId: string,
  content: object
): void {
  mkdirSync(issuesDir(runDirPath), { recursive: true });
  const filePath = issueArchivePath(runDirPath, issueId);
  const tmpPath = `${filePath}~${randomBytes(4).toString('hex')}`;
  writeJsonFile(tmpPath, content);
  renameSync(tmpPath, filePath);
}
