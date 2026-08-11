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
import { basename, join } from 'path';
import { writeJsonFile } from '../../../utils/fileutils';
import { nxVersion } from '../../../utils/versions';
import { MIGRATE_RUNS_RELATIVE_DIR } from '../agentic/types';
import { RUN_ID_SAFE } from './run-id';

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
// Package names make up the rest of a handoff path, so without this segment
// they would occupy the run directory's top level, leaving Nx no name it
// could add there safely.
const RUN_HANDOFFS_DIR_NAME = 'handoffs';
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
  // `<package>:<name>`.
  migrationId: string;
  status: MigrateStepStatus;
  attempt: number;
  dispenseCount: number;
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
  // Set once a step's generator half has run, before the commit is attempted,
  // so a retry after a failed commit or install re-emits only the prompt (or
  // commits what is already in the tree) instead of reapplying the changes.
  generatorCompleted?: boolean;
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
  status: MigrateRunStatus;
  createCommits: boolean;
  commitPrefix: string;
  // The run's install policy, captured from the flags the run was started
  // with: dispensed workers are re-invoked by the loop and never see them.
  skipInstall?: boolean;
  rounds: MigrateRunRound[];
  steps: MigrateStep[];
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

/**
 * The one subtree of a run directory the driving agent writes: its handoff
 * files. Everything else under the run directory is state Nx owns and reads
 * back, so nothing Nx writes belongs in here and no agent write belongs
 * outside it.
 */
export function runHandoffsDir(runDirPath: string): string {
  return join(runDirPath, RUN_HANDOFFS_DIR_NAME);
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
    typeof value.migrationId === 'string' &&
    SHELL_SAFE_VALUE.test(value.migrationId) &&
    isOneOf(MIGRATE_STEP_STATUSES, value.status) &&
    typeof value.attempt === 'number' &&
    typeof value.dispenseCount === 'number' &&
    isOptionalNumber(value.pid) &&
    isOptionalString(value.startedAt) &&
    isOptionalString(value.finishedAt) &&
    isOptionalString(value.gitRefBefore) &&
    isOptionalBoolean(value.treeCleanAtDispense) &&
    isOptionalString(value.depsHashAtDispense) &&
    isStepOutcomeShape(value.outcome) &&
    isPromptOutcomeShape(value.promptOutcome) &&
    isOptionalBoolean(value.generatorCompleted) &&
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
    Array.isArray(value.stepIds) &&
    value.stepIds.every((id) => typeof id === 'string') &&
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
    ISO_TIMESTAMP.test(parsed.createdAt as string) &&
    typeof parsed.formatVersion === 'number' &&
    typeof parsed.createCommits === 'boolean' &&
    isOneOf(MIGRATE_RUN_STATUSES, parsed.status) &&
    isOptionalBoolean(parsed.checkpointFailed) &&
    isOptionalBoolean(parsed.skipInstall) &&
    (parsed.rounds as unknown[]).every(isRoundShape) &&
    (parsed.steps as unknown[]).every(isStepShape) &&
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
 * Adding a member to any persisted closed set (run status, step status,
 * prompt-outcome status, commit kind) needs a
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
  // field's type on purpose, and classifying that as corruption would surface
  // it as a corrupt run to fix or remove, when the real remediation is
  // re-running with the newer Nx that owns it.
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
  // The directory name is the run id every caller reached this state through,
  // so a run.json naming a different one is not this run: the commands built
  // from the persisted copy would send the agent somewhere else.
  if (parsed.runId !== basename(runDirPath)) {
    // JSON-quoted rather than interpolated bare: the rejected value is the
    // untrusted one, and this reason is rendered into the stdout the agent
    // scans for blocks.
    throw corruptRunStateError(
      filePath,
      `declares run id ${JSON.stringify(
        parsed.runId
      )} but sits in a directory named ${JSON.stringify(basename(runDirPath))}.`
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
  // Created up front, and each step's package directory at dispense, so the
  // agent never has to `mkdir -p`: that costs a workspace-permission prompt in
  // agents like Claude Code, on every step.
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
