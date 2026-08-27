import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  type Dirent,
} from 'fs';
import { createHash, randomBytes } from 'crypto';
import { basename, join } from 'path';
import { writeJsonFile } from '../../../utils/fileutils';
import { GIT_SHA } from '../../../utils/git-utils';
import { nxVersion } from '../../../utils/versions';
import { HANDOFFS_DIR_NAME, MIGRATE_RUNS_RELATIVE_DIR } from '../agentic/types';
import { RUN_ID_SAFE } from './run-id';
import { singleLine } from '../text';

export const CURRENT_RUN_STATE_FORMAT_VERSION = 1;

export const RUN_STATE_FILE_NAME = 'run.json';
/**
 * The charset a migration id must stay inside to be interpolated into a
 * dispensed command. The outer agent executes those verbatim, so hostile ids
 * are refused rather than quoted per-platform (POSIX quoting is no defense in
 * cmd.exe). Enforced twice: on the incoming plan at init, so a bad id never
 * starts a run, and here on read, so a run whose persisted ids were tampered
 * with fails closed as corrupt instead of being dispensed.
 */
export const SHELL_SAFE_VALUE = /^[A-Za-z0-9@/:._-]+$/;
// `new Date().toISOString()`, the only shape Nx writes. Retention and active-run
// selection compare these lexicographically, and the value is rendered into the
// stdout the agent scans for blocks, so neither a different notation nor an
// embedded newline can be tolerated.
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
/**
 * A round's snapshot is a file Nx writes next to `run.json`, so the recorded
 * name is a bare `plan-<round>.json`. Pinning the whole name is what keeps a
 * tampered value from resolving outside the run directory when the worker
 * joins it, and from reaching stdout with a line break in it when the worker
 * reports the snapshot missing.
 */
const PLAN_SNAPSHOT_NAME = /^plan-\d+\.json$/;
/**
 * Nx numbers its steps off the plan, so a recorded id is a bare `step-<n>`.
 * The state machine names the id back in the reason it rejects an illegal
 * transition with, and the worker throws that reason, which puts it in front
 * of the agent without passing the block-safe writer.
 */
const STEP_ID = /^step-\d{1,18}$/;
// The id names the archived detail file in the run's issues directory, so a
// tampered value must not resolve outside it. The suffix is bounded so the
// allocator, which mints against this same pattern, can never produce an id
// past the filesystem's component limit and then fail forever.
export const ISSUE_ID = /^issue-\d{1,18}$/;
/**
 * A resume joins this to the run directory and re-emits the file's bytes
 * verbatim, so a tampered value naming a sibling (`run.json`, a plan
 * snapshot) would leak that file's bytes past every line-safety check.
 */
const RUNBOOK_NAME = /^RUNBOOK\.md$/;
// The terminators `singleLine` collapses. An embedded one could open a forged
// block at a line start in the stdout the agent scans.
const LINE_TERMINATORS = /[\r\n\u000b\u000c\u0085\u2028\u2029]/;
// Keeps `.nx/migrate-runs` from growing unbounded across many `nx migrate`
// invocations over the life of a workspace.
const MAX_RETAINED_COMPLETED_RUNS = 5;

// Closed sets are declared as const arrays so the derived types and the
// runtime validation in `readRunState` cannot drift apart (same pattern as
// STEP_ACTIONS in step-actions.ts).
const MIGRATE_RUN_STATUSES = ['active', 'completed'] as const;
export type MigrateRunStatus = (typeof MIGRATE_RUN_STATUSES)[number];

export interface MigrateRunRound {
  index: number;
  planHash: string;
  planSnapshot: string;
}

const MIGRATE_STEP_STATUSES = [
  'pending',
  'dispensed',
  'running',
  'awaiting-prompt-outcome',
  'succeeded',
  'failed',
  'skipped',
  'died',
] as const;
export type MigrateStepStatus = (typeof MIGRATE_STEP_STATUSES)[number];

// 'failed' and 'died' are not terminal: both can be re-armed into a fresh
// attempt.
export const TERMINAL_STEP_STATUSES: ReadonlySet<MigrateStepStatus> = new Set([
  'succeeded',
  'skipped',
]);

const PROMPT_OUTCOME_STATUSES = ['completed', 'skipped', 'failed'] as const;
export type PromptOutcomeStatus = (typeof PROMPT_OUTCOME_STATUSES)[number];

const MIGRATE_STEP_AWAITING_KINDS = [
  'migration-prompt',
  'generator-validation',
] as const;
export type MigrateStepAwaitingKind =
  (typeof MIGRATE_STEP_AWAITING_KINDS)[number];

export interface MigrateStepOutcome {
  fileChanges?: string[];
  gitRefAfter?: string;
  nextSteps?: string[];
  summary?: string;
}

export interface MigrateStepPromptOutcome {
  status: PromptOutcomeStatus;
  summary?: string;
}

export interface MigrateStep {
  id: string;
  roundIndex: number;
  // `<package>:<name>`.
  migrationId: string;
  status: MigrateStepStatus;
  attempt: number;
  dispenseCount: number;
  // Whether the planned migration has a generator half. Decides what a
  // pre-marker retry costs: re-prompting the agent is the designed recovery,
  // rerunning a generator can apply it twice. Absent is read as having one.
  hasGenerator?: boolean;
  pid?: number;
  startedAt?: string;
  finishedAt?: string;
  gitRefBefore?: string;
  // Whether the working tree was clean when this step was dispensed. A failed
  // probe records `false`: a clean retry discards everything back to
  // `gitRefBefore`, so anything but a confirmed-clean tree must withhold it.
  // Absent (a run created before this field existed) is treated as unsafe too.
  treeCleanAtDispense?: boolean;
  // Hash of the workspace dependencies the last time they were known to be
  // installed: recorded at the step's first dispense, then moved forward by
  // each install that lands. A later install decision compares against it, so
  // it must not track what the step wrote but has not installed. Preserved
  // across re-arms. Absent (the dispense-time probe failed) means unknown, not
  // unchanged, and installs; a re-dispense re-probes for it.
  depsHashAtDispense?: string;
  outcome?: MigrateStepOutcome;
  // Folded from the handoff file at reconcile time.
  promptOutcome?: MigrateStepPromptOutcome;
  // Recorded when the step enters 'awaiting-prompt-outcome'; dropped on re-arm
  // with the other per-attempt fields.
  awaitingKind?: MigrateStepAwaitingKind;
  // Set after the generator half runs and before the commit is attempted, so a
  // retry finishes the step instead of reapplying the changes. Dropped with the
  // four marker fields below when a retry's reset discards those changes.
  generatorCompleted?: boolean;
  // The attempt the marker was recorded on: the lineage boundary a retry will
  // not re-hand stored agent-work payloads from below. Absent must stay
  // meaningful: an older nx's re-arm drops it while leaving the files.
  generatorCompletedAtAttempt?: number;
  // Set with the marker when the generator waived its AI step via
  // `skipAgentic`, so a retry does not re-emit work it called unnecessary.
  agenticWaived?: boolean;
  // Set with the marker when the generator's changes owe the run's validation
  // pass. A retry cannot recompute it (the generator result went with the
  // attempt that ran it); absent means none was owed, older states included.
  validationOwed?: boolean;
  // Whether the completed generator changed any files: it decides whether a
  // retry owes a commit, and a no-op step's commit would absorb unrelated
  // pending diffs under its name. Absent (an older nx's marker) still commits.
  generatorMadeChanges?: boolean;
  // Set when the run could not install the dependency changes this step left
  // behind, cleared by the next install that lands. The invocation that hit
  // the failure warns and exits, so without this the completion report could
  // not tell an installed step from one whose dependencies never made it into
  // node_modules.
  installFailed?: boolean;
}

const MIGRATE_COMMIT_KINDS = ['checkpoint', 'landed', 'failed'] as const;
export type MigrateCommitKind = (typeof MIGRATE_COMMIT_KINDS)[number];

export interface MigrateCommitLedgerEntry {
  // Absent on 'failed' entries.
  sha?: string;
  kind: MigrateCommitKind;
  stepIds: string[];
  // Issues from the run's ledger whose fixes this commit carries.
  issueIds?: string[];
}

/**
 * Dedup key: the same underlying problem reported twice folds into one ledger
 * entry. Derived from the normalized summary, so agent text never becomes a
 * path or command fragment; the state reader re-checks the derivation on
 * every persisted entry.
 */
export function issueFingerprint(summary: string): string {
  return createHash('sha256')
    .update(summary.toLowerCase().replace(/\s+/g, ' ').trim())
    .digest('hex')
    .slice(0, 16);
}

export const MIGRATE_ISSUE_DISPOSITIONS = [
  'recorded',
  'resolved',
  'deferred-final',
] as const;
export type MigrateIssueDisposition =
  (typeof MIGRATE_ISSUE_DISPOSITIONS)[number];

export interface MigrateRunIssue {
  id: string;
  fingerprint: string;
  summary: string;
  reportedByStepId: string;
  // Mapped by Nx from the migration ids the reporting session named; 'unknown'
  // when the report could not scope it.
  applicableStepIds: string[] | 'unknown';
  disposition: MigrateIssueDisposition;
  // Set by Nx when a dispense hands the issue to an in-scope step to fix.
  claimedByStepId?: string;
  // A later commit that absorbs the step's tree carries the fix, so the
  // association outlives that step's own failed commit attempt.
  resolvedByStepId?: string;
  // Commits ledger length when the resolution was recorded. The ledger is
  // append-only, so entries below it predate the resolution and cannot carry
  // the fix, whoever they name.
  resolvedAtCommitCount?: number;
}

export interface MigrateRunAnalytics {
  startEmitted: boolean;
  completeEmitted: boolean;
}

// Consecutive orchestrator responses that repeated content with no durable
// state transition between them; the orchestrator defines "the same".
export interface MigrateRunNoProgress {
  fingerprint: string;
  consecutiveCount: number;
  firstSeenAt: string;
}

export interface MigrateRunState {
  formatVersion: number;
  runId: string;
  createdAt: string;
  nxVersion: string;
  status: MigrateRunStatus;
  createCommits: boolean;
  commitPrefix: string;
  // The run's install policy, captured from the flags the run was started
  // with: dispensed workers are re-invoked by the loop and never see them.
  skipInstall?: boolean;
  // Whether generator changes get a validation pass dispensed over them,
  // captured like the install policy above.
  validate?: boolean;
  // A bare file name despite the field name; it is joined to the run directory.
  runbookPath?: string;
  rounds: MigrateRunRound[];
  steps: MigrateStep[];
  commits: MigrateCommitLedgerEntry[];
  // Issues reported by agent sessions over the life of the run, in reporting
  // order so issue ids stay stable.
  issues?: MigrateRunIssue[];
  noProgress?: MigrateRunNoProgress;
  // Set when the tree still held uncommitted changes after the init preflight
  // (checkpoint commit plus gitignore fallback, both of which swallow their own
  // failures): those changes predate every step's gitRefBefore, so a clean
  // retry (tree reset) must not be offered. Cleared if a resume retry leaves
  // the tree fully committed before any migration step runs.
  checkpointFailed?: boolean;
  analytics: MigrateRunAnalytics;
}

const REQUIRED_TOP_LEVEL_FIELDS: readonly (keyof MigrateRunState)[] = [
  'formatVersion',
  'runId',
  'createdAt',
  'nxVersion',
  'status',
  'createCommits',
  'commitPrefix',
  'rounds',
  'steps',
  'commits',
  'analytics',
];

export function migrateRunsDir(root: string): string {
  return join(root, MIGRATE_RUNS_RELATIVE_DIR);
}

export function runDir(root: string, runId: string): string {
  return join(migrateRunsDir(root), runId);
}

/** See `HANDOFFS_DIR_NAME` for why the subtree exists. */
export function runHandoffsDir(runDirPath: string): string {
  return join(runDirPath, HANDOFFS_DIR_NAME);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const REQUIRED_ARRAY_FIELDS: readonly (keyof MigrateRunState)[] = [
  'rounds',
  'steps',
  'commits',
];
const REQUIRED_STRING_FIELDS: readonly (keyof MigrateRunState)[] = [
  'runId',
  'createdAt',
  'nxVersion',
  'status',
  'commitPrefix',
];

function isOneOf<T extends string>(
  values: readonly T[],
  value: unknown
): value is T {
  return (
    typeof value === 'string' && (values as readonly string[]).includes(value)
  );
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || typeof value === 'number';
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === 'boolean';
}

// A recorded `git rev-parse` output. `RegExp.test` stringifies its argument,
// so a numeric 1234 would pass the hex test without the type check.
function isOptionalSha(value: unknown): boolean {
  return (
    value === undefined || (typeof value === 'string' && GIT_SHA.test(value))
  );
}

function isOptionalStringArray(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  );
}

function isOptionalMatching(pattern: RegExp, value: unknown): boolean {
  return (
    value === undefined || (typeof value === 'string' && pattern.test(value))
  );
}

function isLineSafeString(value: unknown): boolean {
  return typeof value === 'string' && !LINE_TERMINATORS.test(value);
}

function isStepIdArray(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every((id) => typeof id === 'string' && STEP_ID.test(id))
  );
}

function isRoundShape(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    typeof value.index === 'number' &&
    typeof value.planHash === 'string' &&
    typeof value.planSnapshot === 'string' &&
    PLAN_SNAPSHOT_NAME.test(value.planSnapshot)
  );
}

function isStepOutcomeShape(value: unknown): boolean {
  return (
    value === undefined ||
    (isPlainObject(value) &&
      isOptionalStringArray(value.fileChanges) &&
      isOptionalSha(value.gitRefAfter) &&
      isOptionalStringArray(value.nextSteps) &&
      isOptionalString(value.summary))
  );
}

function isPromptOutcomeShape(value: unknown): boolean {
  return (
    value === undefined ||
    (isPlainObject(value) &&
      isOneOf(PROMPT_OUTCOME_STATUSES, value.status) &&
      isOptionalString(value.summary))
  );
}

function isStepShape(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    typeof value.id === 'string' &&
    STEP_ID.test(value.id) &&
    typeof value.roundIndex === 'number' &&
    typeof value.migrationId === 'string' &&
    SHELL_SAFE_VALUE.test(value.migrationId) &&
    isOneOf(MIGRATE_STEP_STATUSES, value.status) &&
    // The attempt is interpolated into the stored-payload file name and
    // range-compared against it (agent-work-payload.ts), so a fractional or
    // non-finite value (JSON's 1e400 parses to Infinity) must be refused here.
    Number.isSafeInteger(value.attempt) &&
    (value.attempt as number) >= 1 &&
    typeof value.dispenseCount === 'number' &&
    isOptionalBoolean(value.hasGenerator) &&
    isOptionalNumber(value.pid) &&
    isOptionalString(value.startedAt) &&
    isOptionalString(value.finishedAt) &&
    isOptionalSha(value.gitRefBefore) &&
    isOptionalBoolean(value.treeCleanAtDispense) &&
    isOptionalString(value.depsHashAtDispense) &&
    isStepOutcomeShape(value.outcome) &&
    isPromptOutcomeShape(value.promptOutcome) &&
    (value.awaitingKind === undefined ||
      isOneOf(MIGRATE_STEP_AWAITING_KINDS, value.awaitingKind)) &&
    isOptionalBoolean(value.generatorCompleted) &&
    // Bounded by the step's attempt: a higher value could not name one that
    // exists.
    (value.generatorCompletedAtAttempt === undefined ||
      (Number.isSafeInteger(value.generatorCompletedAtAttempt) &&
        (value.generatorCompletedAtAttempt as number) >= 1 &&
        (value.generatorCompletedAtAttempt as number) <=
          (value.attempt as number))) &&
    isOptionalBoolean(value.agenticWaived) &&
    isOptionalBoolean(value.validationOwed) &&
    isOptionalBoolean(value.generatorMadeChanges) &&
    isOptionalBoolean(value.installFailed) &&
    // A cross-field invariant the rest of the loop relies on: a running step
    // without a pid is never reclassified as died and no step action targets
    // it, so it stalls the run forever.
    (value.status === 'running' ? typeof value.pid === 'number' : true)
  );
}

function isCommitLedgerEntryShape(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    isOneOf(MIGRATE_COMMIT_KINDS, value.kind) &&
    isStepIdArray(value.stepIds) &&
    isOptionalSha(value.sha) &&
    (value.issueIds === undefined ||
      (Array.isArray(value.issueIds) &&
        value.issueIds.every(
          (id) => typeof id === 'string' && ISSUE_ID.test(id)
        )))
  );
}

// The id names the archived `issues/<id>.json`, so a duplicate would alias two
// entries onto one file. Runs after isIssueShape, so the ids are known strings.
function hasUniqueIssueIds(issues: unknown[]): boolean {
  return (
    new Set(issues.map((issue) => (issue as { id: string }).id)).size ===
    issues.length
  );
}

// A duplicate would make every step lookup ambiguous, and a bare-package
// report against it would write applicability this same reader rejects.
function hasUniqueStepIds(steps: unknown[]): boolean {
  return (
    new Set(steps.map((step) => (step as { id: string }).id)).size ===
    steps.length
  );
}

// The fingerprint is the duplicate-report fold key; two entries sharing one
// would make ledger order decide which entry a report folds into.
function hasUniqueIssueFingerprints(issues: unknown[]): boolean {
  return (
    new Set(
      issues.map((issue) => (issue as { fingerprint: string }).fingerprint)
    ).size === issues.length
  );
}

// Cross-entry references, checked after the per-entry shapes so the casts
// hold. nx never writes these violations, and the helpers that trust the
// fields (routing, resolver credit, carried checks) cannot repair them.
function hasSoundIssueRefs(parsed: Record<string, unknown>): boolean {
  const issues = parsed.issues as {
    reportedByStepId: string;
    applicableStepIds: string[] | 'unknown';
    claimedByStepId?: string;
    resolvedByStepId?: string;
    resolvedAtCommitCount?: number;
  }[];
  const steps = parsed.steps as { id: string }[];
  const stepIds = new Set(steps.map((s) => s.id));
  const stepOrder = new Map(steps.map((s, index) => [s.id, index]));
  const commitCount = (parsed.commits as unknown[]).length;
  return issues.every(
    (issue) =>
      stepIds.has(issue.reportedByStepId) &&
      (issue.applicableStepIds === 'unknown' ||
        (issue.applicableStepIds.every((id) => stepIds.has(id)) &&
          // Applicability is a plan-ordered set (mints and merges both emit it that
          // way): a duplicate would read as newly supplied routing in the normalizing
          // merge, and an unordered scope is a shape no transition writes.
          issue.applicableStepIds.every(
            (id, index) =>
              index === 0 ||
              (stepOrder.get(issue.applicableStepIds[index - 1]) as number) <
                (stepOrder.get(id) as number)
          ))) &&
      (issue.claimedByStepId === undefined ||
        (Array.isArray(issue.applicableStepIds) &&
          issue.applicableStepIds.includes(issue.claimedByStepId))) &&
      (issue.resolvedByStepId === undefined ||
        stepIds.has(issue.resolvedByStepId)) &&
      (issue.resolvedAtCommitCount === undefined ||
        issue.resolvedAtCommitCount <= commitCount)
  );
}

function isIssueShape(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    typeof value.id === 'string' &&
    ISSUE_ID.test(value.id) &&
    isLineSafeString(value.summary) &&
    // The derivation is enforced, not just the shape: a fingerprint detached from
    // its summary would split one problem into independent histories.
    value.fingerprint === issueFingerprint(value.summary as string) &&
    typeof value.reportedByStepId === 'string' &&
    STEP_ID.test(value.reportedByStepId) &&
    // Reports carry 1+ identifiers and merges only widen, so [] is unproducible.
    (value.applicableStepIds === 'unknown' ||
      (isStepIdArray(value.applicableStepIds) &&
        (value.applicableStepIds as string[]).length > 0)) &&
    isOneOf(MIGRATE_ISSUE_DISPOSITIONS, value.disposition) &&
    isOptionalMatching(STEP_ID, value.claimedByStepId) &&
    isOptionalMatching(STEP_ID, value.resolvedByStepId) &&
    // The helpers built on these (commit association, retry-clean reverts, update
    // ownership) break on a state outside them.
    (value.claimedByStepId === undefined || value.disposition === 'recorded') &&
    (value.disposition === 'resolved') ===
      (value.resolvedByStepId !== undefined) &&
    // A resolution without a stamp has no carried-commit window; a stamp without
    // a resolution fences nothing that exists.
    (value.disposition === 'resolved') ===
      (value.resolvedAtCommitCount !== undefined) &&
    (value.resolvedAtCommitCount === undefined ||
      (Number.isSafeInteger(value.resolvedAtCommitCount) &&
        (value.resolvedAtCommitCount as number) >= 0))
  );
}

// The record drives the no-progress cutoff: a count outside the positive
// integers (JSON's 1e400 parses to Infinity) could delay it forever, and an
// empty fingerprint would collapse unrelated responses into one streak.
function isNoProgressShape(value: unknown): boolean {
  return (
    value === undefined ||
    (isPlainObject(value) &&
      isLineSafeString(value.fingerprint) &&
      (value.fingerprint as string).length > 0 &&
      Number.isSafeInteger(value.consecutiveCount) &&
      (value.consecutiveCount as number) > 0 &&
      typeof value.firstSeenAt === 'string' &&
      ISO_TIMESTAMP.test(value.firstSeenAt))
  );
}

function isAnalyticsShape(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    typeof value.startEmitted === 'boolean' &&
    typeof value.completeEmitted === 'boolean'
  );
}

// A field present with the wrong type must fail here, not reach a
// `.find`/iteration deep in the worker or orchestrator as a raw TypeError.
// That includes array elements (`steps: [null]`) and closed-set values: a
// mangled `status` would otherwise read as neither active nor completed and
// let a competing run start on top of this one.
function hasValidRunStateShape(parsed: Record<string, unknown>): boolean {
  return (
    REQUIRED_ARRAY_FIELDS.every((field) => Array.isArray(parsed[field])) &&
    REQUIRED_STRING_FIELDS.every(
      (field) => typeof parsed[field] === 'string'
    ) &&
    ISO_TIMESTAMP.test(parsed.createdAt as string) &&
    typeof parsed.formatVersion === 'number' &&
    typeof parsed.createCommits === 'boolean' &&
    isOneOf(MIGRATE_RUN_STATUSES, parsed.status) &&
    isOptionalBoolean(parsed.checkpointFailed) &&
    isOptionalBoolean(parsed.skipInstall) &&
    isOptionalBoolean(parsed.validate) &&
    isOptionalMatching(RUNBOOK_NAME, parsed.runbookPath) &&
    (parsed.rounds as unknown[]).every(isRoundShape) &&
    (parsed.steps as unknown[]).every(isStepShape) &&
    hasUniqueStepIds(parsed.steps as unknown[]) &&
    (parsed.commits as unknown[]).every(isCommitLedgerEntryShape) &&
    (parsed.issues === undefined ||
      (Array.isArray(parsed.issues) &&
        parsed.issues.every(isIssueShape) &&
        hasUniqueIssueIds(parsed.issues) &&
        hasUniqueIssueFingerprints(parsed.issues) &&
        hasSoundIssueRefs(parsed))) &&
    // Written only for issues that already existed: a dangling id could make a
    // future issue's resolution look carried by a commit that predates it.
    (parsed.commits as { issueIds?: string[] }[]).every(
      (c) =>
        c.issueIds === undefined ||
        c.issueIds.every((id) =>
          ((parsed.issues as { id: string }[] | undefined) ?? []).some(
            (i) => i.id === id
          )
        )
    ) &&
    isNoProgressShape(parsed.noProgress) &&
    isAnalyticsShape(parsed.analytics)
  );
}

function corruptRunStateError(filePath: string, reason: string): Error {
  return new Error(`Corrupt run state at ${filePath}: ${reason}`);
}

/**
 * Thrown when a run.json declares a `formatVersion` newer than this Nx
 * understands. Callers must not treat such a run as absent: an older Nx
 * ignoring a newer active run would start a competing run on top of it.
 *
 * Adding a member to any persisted closed set (run status, step status,
 * awaiting kind, prompt-outcome status, commit kind, issue disposition) needs a
 * `CURRENT_RUN_STATE_FORMAT_VERSION` bump: without it, an older Nx reading
 * the new value would reject the run as corrupt (the closed-set validation
 * fails) instead of refusing with this error's ask for a newer Nx.
 */
export class NewerRunStateFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NewerRunStateFormatError';
  }
}

/**
 * Reads and validates `run.json` from a run directory. A `formatVersion`
 * newer than {@link CURRENT_RUN_STATE_FORMAT_VERSION} throws instead of being
 * read best-effort; an older one is returned as-is.
 */
export function readRunState(runDirPath: string): MigrateRunState {
  const filePath = join(runDirPath, RUN_STATE_FILE_NAME);
  const content = readFileSync(filePath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw corruptRunStateError(filePath, 'not valid JSON.');
  }
  if (!isPlainObject(parsed)) {
    throw corruptRunStateError(
      filePath,
      'is missing required fields or has fields of an unexpected type.'
    );
  }
  // Version refusal must precede shape validation: a newer format may change a
  // field's type on purpose, and classifying that as corruption would surface
  // it as a corrupt run to fix or remove, when the real remediation is
  // re-running with the newer Nx that owns it.
  if (
    typeof parsed.formatVersion === 'number' &&
    parsed.formatVersion > CURRENT_RUN_STATE_FORMAT_VERSION
  ) {
    // This refusal runs before the shape check, so `nxVersion` has not been
    // validated yet and the error carrying it leaves through handleErrors,
    // which prints the message's own lines rather than the block-safe writer.
    const createdBy =
      typeof parsed.nxVersion === 'string'
        ? `Nx ${singleLine(parsed.nxVersion)}`
        : 'a newer version of Nx';
    throw new NewerRunStateFormatError(
      `This migrate run was created with ${createdBy} (run state format v${parsed.formatVersion}), which is newer than the Nx version currently running, ${nxVersion} (run state format v${CURRENT_RUN_STATE_FORMAT_VERSION}). Re-run your migrate command with ${createdBy} or later to resume this run.`
    );
  }
  if (
    REQUIRED_TOP_LEVEL_FIELDS.some((field) => !(field in parsed)) ||
    !hasValidRunStateShape(parsed)
  ) {
    throw corruptRunStateError(
      filePath,
      'is missing required fields or has fields of an unexpected type.'
    );
  }
  // The directory name is the run id every caller reached this state through,
  // so a run.json naming a different one is not this run: the commands built
  // from the persisted copy would send the agent somewhere else.
  if (parsed.runId !== basename(runDirPath)) {
    // Collapsed, then quoted: the rejected value is the untrusted one and this
    // reason reaches the stdout the agent scans for blocks. Quoting alone
    // would not do it, since JSON.stringify leaves the Unicode line separators
    // literal.
    throw corruptRunStateError(
      filePath,
      `declares run id ${JSON.stringify(
        singleLine(parsed.runId as string)
      )} but sits in a directory named ${JSON.stringify(
        singleLine(basename(runDirPath))
      )}.`
    );
  }
  return parsed as unknown as MigrateRunState;
}

/**
 * Writes `run.json` atomically: serializes to a temp file in the same
 * directory, then renames over the real path. A crash mid-write can only
 * ever leave the stale temp file behind, never a half-written run.json.
 *
 * Rename gives per-write atomicity only. Serializing the read-modify-write
 * sequences that concurrent nx migrate processes run is state-lock.ts's job.
 */
export function writeRunState(
  runDirPath: string,
  state: MigrateRunState
): void {
  const filePath = join(runDirPath, RUN_STATE_FILE_NAME);
  const tmpPath = `${filePath}~${randomBytes(4).toString('hex')}`;
  writeJsonFile(tmpPath, state);
  renameSync(tmpPath, filePath);
}

// ENOENT is the ordinary "no runs yet" answer. Any other failure (EACCES,
// ENOTDIR) hides runs that may exist, so it propagates rather than reading
// as an empty directory.
function readDirEntries(dir: string): Dirent[] {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
    throw e;
  }
}

// Whether a directory holds a run at all. False for a path that doesn't exist
// (a run id the user made up) and for one that does but holds no run.json (a
// legacy per-version agentic scratch dir).
export function hasRunState(runDirPath: string): boolean {
  return existsSync(join(runDirPath, RUN_STATE_FILE_NAME));
}

// Corrupt run.json reads as null; a newer-format run.json propagates so
// callers can't mistake an incompatible run for an absent one.
function readRunDirState(candidateDir: string): MigrateRunState | null {
  if (!hasRunState(candidateDir)) return null;
  try {
    return readRunState(candidateDir);
  } catch (e) {
    if (e instanceof NewerRunStateFormatError) throw e;
    return null;
  }
}

export interface UninterpretableRunDir {
  dirName: string;
  reason: string;
}

/**
 * Scans for the newest active run. A dir that holds a run.json but could be an
 * active run this caller cannot use is returned as `uninterpretable` instead
 * of being silently skipped: treating it as absent would let a run-starting
 * caller create a competing run that re-applies migrations the first run
 * already applied. That covers unreadable or corrupt content, where whether
 * the run is active cannot be determined, and an active run in a dir whose
 * name fails {@link RUN_ID_SAFE}, which cannot be resumed either.
 *
 * A dir that reads cleanly as a finished run is skipped whatever its name is:
 * it competes with nothing, and reporting it would block every future run
 * with no way for retention to ever clear it.
 *
 * Throws {@link NewerRunStateFormatError} when any run dir holds a
 * newer-format run.json: whether that run is active can't be determined
 * here, and its remediation (a newer Nx) differs from the uninterpretable
 * one (fix or remove).
 */
export function findActiveRun(root: string): {
  active: { runId: string; state: MigrateRunState } | null;
  uninterpretable: UninterpretableRunDir[];
} {
  let newest: { runId: string; state: MigrateRunState } | null = null;
  const uninterpretable: UninterpretableRunDir[] = [];
  for (const entry of readDirEntries(migrateRunsDir(root))) {
    if (!entry.isDirectory()) continue;
    const dir = join(migrateRunsDir(root), entry.name);
    if (!hasRunState(dir)) continue;
    let state: MigrateRunState;
    try {
      // Safe for any dir name: the path comes from the directory entry, never
      // from a value interpolated into a command.
      state = readRunState(dir);
    } catch (e) {
      if (e instanceof NewerRunStateFormatError) throw e;
      uninterpretable.push({
        dirName: entry.name,
        reason: e instanceof Error ? e.message : String(e),
      });
      continue;
    }
    if (state.status !== 'active') continue;
    // Run ids are joined into paths and interpolated into dispensed commands,
    // so a dir whose name fails the gate is never trusted as a resumable run.
    if (!RUN_ID_SAFE.test(entry.name)) {
      uninterpretable.push({
        dirName: entry.name,
        reason: 'its name is not a valid run id',
      });
      continue;
    }
    if (!newest || state.createdAt > newest.state.createdAt) {
      newest = { runId: entry.name, state };
    }
  }
  return { active: newest, uninterpretable };
}

/**
 * Creates a new run directory and writes its initial state, then prunes old
 * completed runs so `.nx/migrate-runs` doesn't grow unbounded: only the
 * newest {@link MAX_RETAINED_COMPLETED_RUNS} completed runs are kept. Active
 * runs, the run just created, and legacy per-version runner dirs (no
 * run.json) are never pruned.
 *
 * Retention is best effort. A dir it cannot interpret or cannot remove is
 * left in place: the run's state is already written by then, so failing here
 * would abort a run that exists, and every retry would abort the same way.
 */
export function createRun(root: string, state: MigrateRunState): void {
  const dir = runDir(root, state.runId);
  // Created up front so the agent never has to `mkdir -p`: that costs a
  // workspace-permission prompt in agents like Claude Code, on every step.
  mkdirSync(runHandoffsDir(dir), { recursive: true });
  writeRunState(dir, state);
  pruneCompletedRuns(root, state.runId);
}

function pruneCompletedRuns(root: string, justCreatedRunId: string): void {
  const dir = migrateRunsDir(root);
  const completed: { runId: string; createdAt: string }[] = [];
  for (const entry of readDirEntries(dir)) {
    if (!entry.isDirectory() || entry.name === justCreatedRunId) continue;
    let state: MigrateRunState | null;
    try {
      state = readRunDirState(join(dir, entry.name));
    } catch {
      // A newer-format run belongs to a newer Nx; leave it for that Nx to
      // manage rather than pruning what can't be interpreted here.
      continue;
    }
    if (state?.status === 'completed') {
      completed.push({ runId: entry.name, createdAt: state.createdAt });
    }
  }
  completed
    .sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
    )
    .slice(MAX_RETAINED_COMPLETED_RUNS)
    .forEach((stale) => {
      try {
        rmSync(join(dir, stale.runId), { recursive: true, force: true });
      } catch {
        // Guarded per dir so one that cannot be removed (permissions, a file
        // still held open) neither aborts the run nor stops the others.
      }
    });
}
