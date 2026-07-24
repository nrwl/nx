import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  type Dirent,
} from 'fs';
import { randomBytes } from 'crypto';
import { join } from 'path';
import { writeJsonFile } from '../../../utils/fileutils';
import { nxVersion } from '../../../utils/versions';

export const CURRENT_RUN_STATE_FORMAT_VERSION = 1;

const RUN_STATE_FILE_NAME = 'run.json';
// Keeps `.nx/migrate-runs` from growing unbounded across many `nx migrate`
// invocations over the life of a workspace.
const MAX_RETAINED_COMPLETED_RUNS = 5;

// Closed sets are declared as const arrays so the derived types and the
// runtime validation in `readRunState` cannot drift apart (same pattern as
// STEP_ACTIONS in step-actions.ts).
const MIGRATE_RUN_MODES = ['orchestrated'] as const;
export type MigrateRunMode = (typeof MIGRATE_RUN_MODES)[number];

const MIGRATE_RUN_STATUSES = ['active', 'completed'] as const;
export type MigrateRunStatus = (typeof MIGRATE_RUN_STATUSES)[number];

export interface MigrateRunRound {
  index: number;
  planHash: string;
  planSnapshot: string;
}

const MIGRATE_STEP_KINDS = [
  'peer-compat',
  'install',
  'migration',
  'final-validation',
] as const;
export type MigrateStepKind = (typeof MIGRATE_STEP_KINDS)[number];

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

const PROMPT_OUTCOME_STATUSES = ['completed', 'skipped', 'failed'] as const;
export type PromptOutcomeStatus = (typeof PROMPT_OUTCOME_STATUSES)[number];

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
  kind: MigrateStepKind;
  // Only set for kind 'migration'; `<package>:<name>`. A format-level
  // invariant callers rely on; deliberately not encoded as a
  // kind-discriminated union to avoid churning the rest of this durable
  // shape's typing.
  migrationId?: string;
  status: MigrateStepStatus;
  attempt: number;
  dispenseCount: number;
  pid?: number;
  startedAt?: string;
  finishedAt?: string;
  gitRefBefore?: string;
  outcome?: MigrateStepOutcome;
  // Folded from the handoff file at reconcile time.
  promptOutcome?: MigrateStepPromptOutcome;
  // Set once a hybrid step's generator half has run and committed, so a plain
  // retry re-emits only the prompt instead of reapplying the committed changes.
  generatorCompleted?: boolean;
}

const MIGRATE_ISSUE_DISPOSITIONS = [
  'recorded',
  'claimed',
  'deferred-final',
  'resolved',
] as const;
export type MigrateIssueDisposition =
  (typeof MIGRATE_ISSUE_DISPOSITIONS)[number];

export interface MigrateIssue {
  id: string;
  description: string;
  scope: Record<string, unknown>;
  recordedBy: string;
  disposition: MigrateIssueDisposition;
  claimedBy?: string;
}

const MIGRATE_COMMIT_KINDS = ['checkpoint', 'landed', 'failed'] as const;
export type MigrateCommitKind = (typeof MIGRATE_COMMIT_KINDS)[number];

export interface MigrateCommitLedgerEntry {
  // Absent on 'failed' entries.
  sha?: string;
  kind: MigrateCommitKind;
  stepIds: string[];
  issueIds: string[];
}

export interface MigrateRunAnalytics {
  startEmitted: boolean;
  completeEmitted: boolean;
}

export interface MigrateRunState {
  formatVersion: number;
  runId: string;
  createdAt: string;
  nxVersion: string;
  mode: MigrateRunMode;
  status: MigrateRunStatus;
  createCommits: boolean;
  commitPrefix: string;
  rounds: MigrateRunRound[];
  steps: MigrateStep[];
  issues: MigrateIssue[];
  commits: MigrateCommitLedgerEntry[];
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
  'mode',
  'status',
  'createCommits',
  'commitPrefix',
  'rounds',
  'steps',
  'issues',
  'commits',
  'analytics',
];

export function migrateRunsDir(root: string): string {
  return join(root, '.nx', 'migrate-runs');
}

export function runDir(root: string, runId: string): string {
  return join(migrateRunsDir(root), runId);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const REQUIRED_ARRAY_FIELDS: readonly (keyof MigrateRunState)[] = [
  'rounds',
  'steps',
  'issues',
  'commits',
];
const REQUIRED_STRING_FIELDS: readonly (keyof MigrateRunState)[] = [
  'runId',
  'createdAt',
  'nxVersion',
  'mode',
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

function isOptionalStringArray(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  );
}

function isRoundShape(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    typeof value.index === 'number' &&
    typeof value.planHash === 'string' &&
    typeof value.planSnapshot === 'string'
  );
}

function isStepOutcomeShape(value: unknown): boolean {
  return (
    value === undefined ||
    (isPlainObject(value) &&
      isOptionalStringArray(value.fileChanges) &&
      isOptionalString(value.gitRefAfter) &&
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
    typeof value.roundIndex === 'number' &&
    isOneOf(MIGRATE_STEP_KINDS, value.kind) &&
    isOneOf(MIGRATE_STEP_STATUSES, value.status) &&
    typeof value.attempt === 'number' &&
    typeof value.dispenseCount === 'number' &&
    // The documented format invariant: migration steps carry `<package>:<name>`.
    (value.kind === 'migration'
      ? typeof value.migrationId === 'string'
      : isOptionalString(value.migrationId)) &&
    isOptionalNumber(value.pid) &&
    isOptionalString(value.startedAt) &&
    isOptionalString(value.finishedAt) &&
    isOptionalString(value.gitRefBefore) &&
    isStepOutcomeShape(value.outcome) &&
    isPromptOutcomeShape(value.promptOutcome) &&
    isOptionalBoolean(value.generatorCompleted)
  );
}

function isIssueShape(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    typeof value.id === 'string' &&
    typeof value.description === 'string' &&
    isPlainObject(value.scope) &&
    typeof value.recordedBy === 'string' &&
    isOneOf(MIGRATE_ISSUE_DISPOSITIONS, value.disposition) &&
    isOptionalString(value.claimedBy)
  );
}

function isCommitLedgerEntryShape(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    isOneOf(MIGRATE_COMMIT_KINDS, value.kind) &&
    Array.isArray(value.stepIds) &&
    value.stepIds.every((id) => typeof id === 'string') &&
    Array.isArray(value.issueIds) &&
    value.issueIds.every((id) => typeof id === 'string') &&
    isOptionalString(value.sha)
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
    typeof parsed.formatVersion === 'number' &&
    typeof parsed.createCommits === 'boolean' &&
    isOneOf(MIGRATE_RUN_MODES, parsed.mode) &&
    isOneOf(MIGRATE_RUN_STATUSES, parsed.status) &&
    isOptionalBoolean(parsed.checkpointFailed) &&
    (parsed.rounds as unknown[]).every(isRoundShape) &&
    (parsed.steps as unknown[]).every(isStepShape) &&
    (parsed.issues as unknown[]).every(isIssueShape) &&
    (parsed.commits as unknown[]).every(isCommitLedgerEntryShape) &&
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
 * Adding a member to any persisted closed set (run mode or status, step kind
 * or status, prompt-outcome status, issue disposition, commit kind) needs a
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
 * Reads and validates `run.json` from a run directory.
 *
 * A `formatVersion` newer than {@link CURRENT_RUN_STATE_FORMAT_VERSION} means
 * the run was created by a newer Nx than the one currently running, so the
 * shape may not be interpretable here; this throws rather than attempting a
 * best-effort read. An older `formatVersion` is returned as-is: only v1
 * exists today, so there is nothing to migrate yet.
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
  // field's type on purpose, and classifying that as corruption would let
  // callers that swallow corruption (readRunDirState) treat the run as absent
  // and start a competing one.
  if (
    typeof parsed.formatVersion === 'number' &&
    parsed.formatVersion > CURRENT_RUN_STATE_FORMAT_VERSION
  ) {
    const createdBy =
      typeof parsed.nxVersion === 'string'
        ? `Nx ${parsed.nxVersion}`
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

function readDirEntries(dir: string): Dirent[] {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

// Dirs without a run.json are legacy per-version runner dirs, not runs.
// Corrupt run.json reads as null; a newer-format run.json propagates so
// callers can't mistake an incompatible run for an absent one.
function readRunDirState(candidateDir: string): MigrateRunState | null {
  if (!existsSync(join(candidateDir, RUN_STATE_FILE_NAME))) return null;
  try {
    return readRunState(candidateDir);
  } catch (e) {
    if (e instanceof NewerRunStateFormatError) throw e;
    return null;
  }
}

/**
 * Throws {@link NewerRunStateFormatError} when any run dir holds a
 * newer-format run.json: whether that run is active can't be determined
 * here, and silently ignoring it could start a competing run.
 */
export function findActiveRun(
  root: string
): { runId: string; state: MigrateRunState } | null {
  let newest: { runId: string; state: MigrateRunState } | null = null;
  for (const entry of readDirEntries(migrateRunsDir(root))) {
    if (!entry.isDirectory()) continue;
    const state = readRunDirState(join(migrateRunsDir(root), entry.name));
    if (!state || state.status !== 'active') continue;
    if (!newest || state.createdAt > newest.state.createdAt) {
      newest = { runId: entry.name, state };
    }
  }
  return newest;
}

/**
 * Creates a new run directory and writes its initial state, then prunes old
 * completed runs so `.nx/migrate-runs` doesn't grow unbounded: only the
 * newest {@link MAX_RETAINED_COMPLETED_RUNS} completed runs are kept. Active
 * runs, the run just created, and legacy per-version runner dirs (no
 * run.json) are never pruned.
 */
export function createRun(root: string, state: MigrateRunState): void {
  const dir = runDir(root, state.runId);
  mkdirSync(dir, { recursive: true });
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
    .forEach((stale) =>
      rmSync(join(dir, stale.runId), { recursive: true, force: true })
    );
}
