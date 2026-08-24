// The run's issue ledger: problems agent sessions observe while driving an
// orchestrated migrate run. Agents report them through the handoff file
// (`issues` / `issueUpdates`); nx owns everything else: it validates each
// report, assigns ids and fingerprints, maps the named migrations to plan
// steps, claims recorded issues for the step being dispensed, archives full
// details under the run's issues directory, and renders the bounded digest
// dispensed steps carry.

import { randomBytes } from 'crypto';
import { mkdirSync, readFileSync, renameSync } from 'fs';
import { join } from 'path';
import { writeJsonFile } from '../../../utils/fileutils';
import { MIGRATE_RUNS_RELATIVE_DIR } from '../agentic/types';
import { singleLine } from '../text';
import {
  CURRENT_RUN_STATE_FORMAT_VERSION,
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

// Bounds on a single handoff's issue report. The handoff is agent-written, so
// every count and length is capped before anything reaches the ledger; a
// report over a bound is rejected whole for the agent to fix, never trimmed
// silently.
const MAX_ISSUES_PER_HANDOFF = 20;
const MAX_ISSUE_UPDATES_PER_HANDOFF = 20;
const MAX_SUMMARY_CHARS = 500;
const MAX_DETAIL_CHARS = 8192;
const MAX_NOTE_CHARS = 1000;
const MAX_APPLICABLE_MIGRATIONS = 50;

// Bounds on the digest rendered into dispensed steps: at most this many
// entries, this many bytes of rendered entry lines, and this many characters
// per summary. Overflow is counted, never silently dropped.
const MAX_DIGEST_ENTRIES = 20;
const MAX_DIGEST_BYTES = 8192;
const DIGEST_SUMMARY_CHARS = 200;

// An issue as the agent reported it, after validation. `summary` is collapsed
// to one line (it is rendered into dispensed step content); `detail` is not
// (it only ever lands in the archived JSON file).
export interface ReportedIssue {
  summary: string;
  detail?: string;
  applicableMigrations: string[] | 'unknown';
  disposition?: MigrateIssueDisposition;
}

// A disposition change for an issue the reporting step was assigned.
// 'recorded' is not a legal target: an update only ever progresses an issue.
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

// Unknown keys reject rather than strip: a typoed optional field (e.g.
// "dispositon") would otherwise silently fall back to the default and
// mis-route the issue with no signal back to the agent.
function unknownKey(
  value: Record<string, unknown>,
  allowed: readonly string[]
): string | undefined {
  return Object.keys(value).find((key) => !allowed.includes(key));
}

// A value echoed back into a rejection reason. Collapsed and truncated: it is
// agent-written, and the reason is rendered into the dispensed step content.
function quoted(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const collapsed = singleLine(String(text));
  return JSON.stringify(
    collapsed.length > 100 ? `${collapsed.slice(0, 100)}...` : collapsed
  );
}

/**
 * Validates the `issues` / `issueUpdates` fields of a handoff against the
 * run's current state. Absent fields parse as empty. Any invalid entry
 * rejects the whole report with a reason the awaiting dispense hands back to
 * the agent, so a typo never half-lands in the ledger. The check covers the
 * handoff's other extra fields too: a misspelled field name (say
 * "issueUpates") would otherwise parse as an absent report and be discarded
 * with the folded handoff, with no signal back to the agent.
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
      // One entry per problem: two same-fingerprint entries would make their
      // array order decide which disposition lands (the second one would
      // fold into the first's just-minted entry as a duplicate report).
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
      // One final disposition per issue: sequential updates to the same id
      // would make the order carry meaning the ledger never records.
      if (seenIds.has(parsed.id)) {
        return invalid(
          `"issueUpdates" lists ${parsed.id} more than once; report one final disposition per issue`
        );
      }
      seenIds.add(parsed.id);
      updates.push(parsed);
    }
  }
  // A handoff may not target one issue through both channels: a report that
  // folds into an entry an update also moves would make their fixed apply
  // order (reports, then updates) decide the final disposition.
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
  // Validate the summary in its normalized form: characters like U+0085 are
  // line terminators to singleLine but not to trim, so a raw check could
  // accept a summary that normalizes to the empty string.
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

// Identifier mapping, per the run's contract: a value containing ':' maps
// only to the step with exactly that migration id; a bare value maps to every
// step whose package name is exactly equal (scoped names stay whole; nothing
// splits on '/'). Plan order is the steps' own order, and step ids are
// unique, so the result needs no dedup.
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

// A disposition change to archive alongside the ledger, so the issues
// directory keeps who moved an issue and what the ledger does not carry: an
// update's note, and a repeated report's refined applicability and detail.
// A 'recorded' disposition appears only for nx's own transitions (the
// retry-clean reopen, a repeated-report revival) and for refinements that
// leave a recorded entry recorded; a handoff update can never target it.
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
  // New ledger entries paired with the report they came from, for archiving.
  newIssues: { entry: MigrateRunIssue; report: ReportedIssue }[];
  updates: IssueArchiveUpdate[];
}

/**
 * Applies a validated issue report to the run state. Pure: the caller runs it
 * on fresh state inside the fold's locked write, so ids stay sequential and
 * claim checks hold against what is actually on disk.
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
  let ledgerChanged = false;
  // Allocate past the highest existing suffix, not from the ledger length:
  // the state reader only checks id syntax and uniqueness, so a sparse
  // ledger (say, a lone issue-2) must not mint a duplicate id that would
  // overwrite another issue's archive and corrupt the state. BigInt because
  // a number suffix stops incrementing at 2^53 and would re-mint the same
  // id from there; the digits are exact at any size this way.
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
        ledgerChanged = true;
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
    // The reader bounds accepted suffixes, so only a ledger already at the
    // bound reaches this; throwing keeps the caller's archive error
    // handling in charge instead of writing a state the reader rejects.
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
    // Validated by the caller against the same state; an id that vanished
    // here would mean the ledger dropped entries, which it never does.
    if (index === -1) continue;
    const existing = ledger[index];
    if (existing.disposition !== update.disposition) {
      // The claim dies with any move out of 'recorded': it named an
      // assignment in a digest, and only recorded issues are assigned. The
      // resolver attribution and its stamp live and die with the
      // resolution.
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
      ledgerChanged = true;
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
  // The ledger's rules are what v2 refuses older writers over (see
  // CURRENT_RUN_STATE_FORMAT_VERSION): recording or moving an issue in an
  // older-stamped run upgrades the stamp, so a later downgrade refuses
  // instead of operating the ledger blind. Archive-only activity leaves
  // the stamp alone: a state whose ledger already holds entries acquired
  // them through a stamping mint or move.
  const formatVersion =
    newIssues.length > 0 || ledgerChanged
      ? Math.max(state.formatVersion, CURRENT_RUN_STATE_FORMAT_VERSION)
      : state.formatVersion;
  return {
    state: { ...state, formatVersion, issues: ledger },
    newIssues,
    updates: archiveUpdates,
  };
}

// What a report means for an existing entry. Absent and explicit 'recorded'
// both mean "the problem stands": neither asks for a transition by itself.
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
 * Folds a duplicate report into its existing entry: one cell per (existing
 * disposition x report intent) pair, enumerated exhaustively so a new
 * disposition member fails to compile rather than falling through. Three
 * rules apply across every cell: the report's concrete applicability unions
 * into the entry's (an "unknown" report leaves it as it stands); a recorded
 * entry assigned to another step blocks a resolve/defer intent down to a
 * refinement (an assignment in another step's digest cannot be taken away
 * from outside it, but the report itself is still information); and a cell
 * archives whenever it changed the entry or the report carries detail (the
 * handoff carrying the report is removed on fold, so an unarchived detail
 * would be lost). Claims die with any move out of 'recorded': a claim names
 * an assignment in a dispensed digest, and only recorded issues are
 * assigned.
 */
function applyDuplicateReport(
  existing: MigrateRunIssue,
  report: ReportedIssue,
  reportingStep: MigrateStep,
  state: MigrateRunState
): { entry: MigrateRunIssue; archive: boolean } {
  const intent = reportIntent(report);
  const merged = mergedApplicableStepIds(existing, report, state);
  // Set inclusion, not a length compare: a corrupt entry with duplicate
  // scope ids would otherwise read the normalizing merge as new routing.
  const addedStepIds = !Array.isArray(merged)
    ? []
    : !Array.isArray(existing.applicableStepIds)
      ? merged
      : merged.filter(
          (id) => !(existing.applicableStepIds as string[]).includes(id)
        );
  const widened = addedStepIds.length > 0;
  // Only a live assignment blocks: a claimant that turned terminal can
  // never hand another handoff back, so its claim is stale bookkeeping the
  // settle sweep releases, not ownership.
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
        // The stamp travels with the resolution (I3): only commits appended
        // from here on can carry it, so nothing older, a previous
        // resolution's carrier included, can vouch for this fix.
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
      // Any duplicate report over a resolved entry means the problem came
      // back: resolved issues drop out of the digest, so the reporter
      // cannot be echoing an entry it was shown; it hit the problem again.
      switch (intent) {
        case 'resolved':
          // A recurrence fixed in place: the credit moves to the new
          // resolver, whose fresh stamp keeps the old resolution's commits
          // from vouching for this fix.
          return transition('resolved');
        case 'deferred-final':
        case 'unresolved':
          // Reopen: the resolution attribution dies with its stamp, and
          // the disposition restarts through the same ladder a first
          // report takes on the merged applicability.
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
          // Revive only on newly supplied routing that can still claim the
          // issue: deferred entries are digest-visible, so a repeated
          // report without new scope may just be echoing one, and a
          // deferral, explicit or settled, stands until new scope arrives.
          // The claimable step must be among the ADDED routes: reviving on
          // a pre-existing route's claimability would let routing to
          // already-finished work undo a standing deferral.
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

// Exhaustiveness backstop: a new disposition or intent member fails to
// compile at the call site instead of silently falling into a catch-all.
function unreachable(value: never): never {
  throw new Error(`unexpected value: ${JSON.stringify(value)}`);
}

// Whether some landed commit already carries the issue's current resolution.
// Two scopings keep other commits from vouching for it: the commit must name
// the resolving step (ids attach where the entry's stepIds include the
// resolver), and it must postdate the resolution itself: the stamp written
// with the credit fences off everything older, whether that carried a
// previous resolution of the same issue (the same step's included) or named
// the pair before the resolution existed at all.
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
 * The issue ids a landed commit naming `stepIds` carries: issues resolved by
 * one of those steps and not already carried by an earlier landed entry.
 * Attribution rides on the persisted `resolvedByStepId`, so a resolution
 * whose own commit attempt failed still reaches the later commit that
 * absorbs that step's tree. Derived from the final dispositions, never from
 * report order, so the association cannot contradict the ledger.
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
 * Reverts the resolutions a step's discarded attempt claimed, and releases
 * the step's issue assignments. A retry-clean resets the tree to the step's
 * pre-dispense ref, so a fix that attempt reported as resolved is gone
 * unless a landed commit already carries it; leaving the ledger entry
 * resolved would report a fix that no longer exists and attach its id to
 * whatever the retry eventually lands. Reverted entries go back to
 * 'recorded' where a non-terminal applicable step (the re-armed step
 * included) can pick them up, and to 'deferred-final' otherwise. Claims go
 * with the discarded attempt: an assignment names an agent-work dispense's
 * digest, and the retry may never park for agent work (a no-op generator,
 * say), so a kept claim would render "assigned to this step" with no
 * handoff to report through; the retry's own dispense re-claims what its
 * digest can carry. Pure, like applyReportedIssues; the returned updates
 * are for the archive trail (claim releases are nx's own progression, not
 * archived, like the settle sweep's demotions).
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

// The disposition an entry starts (or, on a reopen, restarts) with. The
// report's own value wins where it can hold: unknown applicability cannot be
// claimed, so it goes straight to 'deferred-final' rather than being
// assigned speculatively, and so does a recorded issue with no claimable
// applicable step left.
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

// A repeated report's applicability unioned into the entry's: concrete
// identifiers widen the known scope, an "unknown" report leaves it as it
// stands.
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

// Whether any applicable step can still pick the issue up. Non-terminal is
// the boundary, not 'pending': a step that just failed (the reporting step
// included, at fold time) can be re-armed, and its retry's agent-work
// dispense claims recorded issues; deferring on its failure would put the
// issue out of that retry's reach.
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

// Union of the mapped step ids across the report's identifiers, deduped, in
// plan order.
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
 * Assigns the still-recorded issues applicable to the step being dispensed
 * to that step, up to what the digest can publish. Runs inside the
 * dispense's locked write, so serial dispensing makes "first remaining
 * applicable step" deterministic; an issue an earlier applicable step left
 * unresolved is reassigned to the next one.
 */
export function claimIssuesForStep(
  state: MigrateRunState,
  stepId: string
): MigrateRunState {
  const issues = state.issues;
  if (!issues) return state;
  // Claims are bounded by what the digest can publish: an assignment the
  // digest cannot list is invisible to its assignee (issueUpdates may only
  // reference digest-marked issues), and once the step turned terminal the
  // settle sweep would demote work the agent was never shown. The walk
  // accumulates the same order and caps as the renderer, whose assigned
  // entries come first, so every claim kept here is guaranteed a digest
  // line; a claim past the caps (a reassignment pushed it out) is released
  // back to plain 'recorded'.
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
 * Demotes recorded issues no remaining step can claim to 'deferred-final',
 * and releases claims whose assignee turned terminal while other applicable
 * steps remain. The report-time deferral in resolveDisposition only sees
 * the run as it stood then; a step later turning terminal without resolving
 * its claimed issues (a success without an issueUpdates entry, a skip, an
 * adopt) would otherwise leave 'recorded' entries the routing contract says
 * are still claimable, or a dead assignment posing as ownership. Run before
 * anything renders, so digests and the completion report never label
 * unclaimable work as available. Pure; returns the same state when nothing
 * changes. No archive record: like a report-time deferral, this is the
 * run's own progression, not a step-authored change.
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
      // The claim goes with the demotion: it named an assignment in a
      // digest, and a deferred issue is assigned nowhere. Leaving it would
      // read as active ownership (e.g. to the duplicate-report resolution
      // rule).
      const { claimedByStepId: _dropped, ...rest } = issue;
      return { ...rest, disposition: 'deferred-final' as const };
    }
    // A claim whose assignee turned terminal without resolving the issue is
    // stale the same way: that step can never hand another handoff back, so
    // the assignment blocks nothing and would read as active ownership. The
    // issue stays recorded for the remaining applicable steps to claim.
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

// Workspace-relative reference to the run's issues directory, for rendered
// text.
function issuesDirRef(runId: string): string {
  return `${MIGRATE_RUNS_RELATIVE_DIR}/${runId}/${ISSUES_DIR_NAME}/`;
}

/**
 * The bounded "Known issues" digest a work dispense carries: unresolved
 * issues ordered assigned-to-this-step, then recorded, then deferred-final.
 * Empty when the ledger holds nothing unresolved.
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

/**
 * The unresolved-issues section of the completion output. Same entries as
 * the digest, without a current step to order first.
 */
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

// Applies the digest bounds to pre-rendered entry lines, counting what they
// drop. The listed set is a prefix of the ordered entries: the first one over
// a cap ends the listing, so the assigned-first ordering survives truncation.
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
 * carry) and appends its updates to the archived files. Failures propagate:
 * the caller keeps the handoff file in place as the fallback detail store
 * when archiving fails. Reconstructed issue ids land in `reconstructedIds`
 * as they happen, so a failure in a later batch cannot swallow an earlier
 * reconstruction: the rebuilt shell is already durable, and a retry finds
 * it healthy, so the throw-interrupted pass is the only chance to warn.
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
  // One append per issue: the whole batch an application produced for an
  // issue lands in a single atomic write, so a crash cannot split it.
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
 * Whether every archive this application touches is on disk and holds what
 * phase 1 wrote for it: a new report's file must equal the full
 * first-report record with an EMPTY update list (routing and both
 * dispositions have no other durable copy; the id did not exist before
 * this fold, the same handoff cannot reference it, and nothing runs
 * between the phases, so any update record is not phase 1's output), and
 * each updated issue's records must END with this application's batch,
 * matching the append path's whole-suffix replay rule (a record merely
 * appearing earlier is another event's, not this one's). A shell phase 1
 * rebuilt for a lost archive carries the ledger's identity values and
 * exactly this batch, so it verifies like any other phase-1 output. The
 * fold's phase-2 re-archive may tolerate a write failure only when
 * everything verifies; anything less would leave the removed handoff as
 * the only copy.
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

// The persisted first-report record (everything but `updates`); shared by
// the write path and the intactness check so their shapes cannot drift.
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
    // Both dispositions, so the file keeps what the reporter asked for
    // apart from where the ladder actually started the entry.
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

// The persisted form of one archive update record; shared by the append
// path and the intactness check so their shapes cannot drift.
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

// Returns true when the archive had to be rebuilt (it was missing or
// corrupt), so the caller can surface the degraded data.
function appendIssueUpdatesToArchive(
  runDirPath: string,
  issueId: string,
  batch: IssueArchiveUpdate[],
  state: MigrateRunState
): boolean {
  const filePath = issueArchivePath(runDirPath, issueId);
  // A missing archive is reconstructed from the run state's fields (the
  // originally reported detail lived only in the lost file) and a corrupt
  // one replaced the same way; the ledger in run.json stays authoritative
  // for dispositions either way, and the caller warns from the returned
  // flag. Any other read failure may hide an intact file, and this is the
  // only durable copy of the issue's detail, so it propagates into the
  // caller's abort-or-warn handling instead of being overwritten.
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
  // Skip a batch the archive already ends with: a crash between the archive
  // writes and the fold's state write re-runs the same application, and the
  // refold must not duplicate what the crashed attempt appended. Compared as
  // a whole suffix, since one application can legally append several records
  // for the same issue.
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

// A parseable archive still reconstructs when its identity is gone or
// wrong: appending onto a hollow or mismatched object would hide the loss
// behind a file the runbook points at as the full record. The bar is
// identity only: with the ledger entry in hand, the file's stable identity
// values (id, fingerprint, summary, reporter) must MATCH it; without the
// entry, their presence, or the bare id-plus-marker shell, is the most
// that is restorable. Everything else in the file (routing, dispositions,
// detail, notes, update records) is informational content this reader does
// not police: run.json stays authoritative for every behavioral decision,
// and authenticating archive history is an explicit non-goal.
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

// What can be rebuilt for a lost archive from the durable run state alone.
// The originally reported detail is gone with the file; the marker keeps
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

// Atomic like every other run artifact write: temp file in the same
// directory, then rename, so a crash can only leave a stale temp file.
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
