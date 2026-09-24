import { execSync } from 'child_process';
import { createHash } from 'crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
  type BigIntStats,
} from 'fs';
import { join } from 'path';
import { IS_WASM } from '../../../native';
import { readJsonFile, writeJsonFile } from '../../../utils/fileutils';
import { publishFileAtomically } from './atomic-write';
import {
  canOfferCleanRetry,
  cleanRetryUnavailableReason,
  resetForCleanRetry,
} from './clean-retry';
import {
  acquireTreeOperation,
  BrokerStaleRequestError,
  BrokerUnavailableError,
  commitStepTree,
  giveUpStepTree,
  installStepTree,
  resetStepTree,
  liveTreeOperation,
  TreeBusyError,
  treeBusyMessage,
  treeOperationLabel,
  type BrokeredCommit,
  type TreeLease,
  type TreeScope,
  type InstallSeam,
} from './broker';
import {
  getAncestorStatus,
  getGitCurrentBranch,
  getGitRepositoryStatus,
  getLatestCommitSha,
  getPathCommitExposure,
  getWorkingTreeStatus,
  type PathCommitExposure,
} from '../../../utils/git-utils';
import { nxVersion } from '../../../utils/versions';
import {
  handoffsDirState,
  runStepHandoffPath,
  readHandoffWithReason,
  readInspectedFile,
  type HandoffReadFailureReason,
  type HandoffReadResult,
} from '../agentic/handoff';
import { resolveFormatCommand } from '../agentic/format-command';
import { applyAgenticHandoffGitignoreFallback } from '../agentic/handoff-gitignore';
import { renderHandoffShapeInline } from '../agentic/prompts/fragments';
import { MIGRATE_RUNS_RELATIVE_DIR, type HandoffFile } from '../agentic/types';
import {
  commitCheckpointBeforeMigrations,
  commitMigrationIfRequested,
} from '../migrate-commits';
import {
  reportMigrateOrchestratorComplete,
  reportMigrateOrchestratorDispense,
  reportMigrateOrchestratorExistingRun,
  reportMigrateOrchestratorInit,
  reportMigrateOrchestratorResume,
  reportMigrateOrchestratorStepDispensed,
} from '../migrate-analytics';
import { sortMigrations } from '../sort-migrations';
import { createRunId, RUN_ID_SAFE } from './run-id';
import {
  createRun,
  findActiveRun,
  hasRunState,
  readRunState,
  migrateRunsDir,
  runDir,
  runHandoffsDir,
  writeRunState,
  CURRENT_RUN_STATE_FORMAT_VERSION,
  RUN_STATE_FILE_NAME,
  SHELL_SAFE_VALUE,
  type MigrateCommitLedgerEntry,
  type MigrateRunNoProgress,
  type MigrateRunPolicy,
  type MigrateRunState,
  type MigrateStep,
  type MigrateStepPromptOutcome,
  type MigrateTreeOperation,
  TERMINAL_STEP_STATUSES,
} from './run-state';
import {
  hasAnyLiveRunActivity,
  heldRunError,
  holdRunActivity,
  liveRunActivityPids,
  registerRunActivity,
  releaseRunActivity,
  updateRunState,
  withRunCreationLock,
  withRunStateLock,
} from './state-lock';
import {
  appendCommit,
  applyStepEvent,
  commitReceipt,
  commitMayBeInHistory,
  commitResultToLedgerEntry,
  completionSummaryLines,
  coveringLandedEntries,
  hasPendingCommitDebt,
  latestRound,
  markInstallFailed,
  splitMigrationId,
  stepsToPendingMigrations,
  tallySteps,
  uncoveredFailedStepIds,
  type StepAction,
  type StepEvent,
  runTallies,
} from './state-machine';
import {
  recordUnresolvedIssue,
  warnAboutGiveUp,
  warnUnresolvedNotArchived,
} from './give-up';
import {
  isPromptOnlyMigration,
  type PlannedMigration,
} from '../migration-shape';
import {
  depsHash,
  installDepsChangedSinceDispense,
  isPidAlive,
  nowIso,
  pmExecPrefix,
  pmInstallCommand,
  summarizeError,
  warnCommitFailed,
} from './util';
import { singleLine } from '../text';
import {
  emitPromptBlock,
  emitRunbookBlock,
  emitStepBlock,
  logToAgent,
  safeLines,
  warnToAgent,
} from './agent-output';
import {
  agentWorkPayloadPath,
  readAgentWorkPayload,
  removeAgentWorkPayloads,
} from './agent-work-payload';
import {
  applyReportedIssues,
  archiveIssues,
  attachIssueIdsToCommitEntry,
  claimIssuesForStep,
  enrichCommitEntryIssueIds,
  applicationArchivesIntact,
  parseHandoffIssues,
  renderIssueDigestLines,
  renderUnresolvedIssueLines,
  settleUnclaimableIssues,
  warnReconstructedArchives,
} from './issues';
import {
  renderRunbook,
  RUNBOOK_FILE_NAME,
  type RunbookContext,
} from './runbook';
import {
  collectExistingRunFacts,
  liveWorkers,
  progressLine,
  recordedCommits,
  renderExistingRunCommands,
  renderExistingRunReport,
  type ExistingRunFacts,
  workersLine,
} from './existing-run-report';
import { detectPackageManager } from '../../../utils/package-manager';

// The dark migrate orchestrator: drives a durable run one dispense at a time.
// An outer AI agent runs each dispensed command and re-invokes `nx migrate
// --run-id=<id>` to reconcile; there is no long-lived process.

const PLAN_SNAPSHOT_0 = 'plan-0.json';
// A running worker older than this may be hung; the still-running dispense
// escalates so the agent can verify or kill it.
const HANG_THRESHOLD_MS = 15 * 60 * 1000;
// Identical responses in a row before the dispense escalates to a
// 'no-progress' action. A still-running worker is exempt until the hang
// threshold: waiting on a live worker is not looping.
const NO_PROGRESS_THRESHOLD = 3;
// Two rearms per step: one for the diagnosed fix and one for its correction.
const REARM_ESCALATION_CAP = 2;

export interface RunOrchestratorInitInput {
  root: string;
  // The full parsed migrations.json, snapshotted verbatim as plan-0.json.
  migrationsJson: { migrations?: PlannedMigration[]; [k: string]: unknown };
  // The --run-migrations path as the user passed it; the start-fresh hint
  // repeats it when it is not the default.
  migrationsPath?: string;
  createCommits: boolean;
  commitPrefix: string;
  // The run's install policy. Dispensed commands carry no flags of the user's,
  // so the run has to record it here for the installs the loop itself runs.
  skipInstall: boolean;
  // Workspace-local nx version; the v23 cutoff for the .gitignore fallback.
  installedNxVersion: string;
  validate: boolean | undefined;
  // Off when a parent process hands the run to an agent it spawns: the runbook
  // reaches that agent as a file and this stdout belongs to the user.
  emitAgentInstructions?: boolean;
  // What to do when a run is already active. 'report' (the default) reports
  // it and starts nothing; 'start-fresh' deletes its record and starts a new
  // run. Continuing an active run is a separate entry point
  // (runOrchestratorResume), never an init outcome.
  onExistingRun?: 'report' | 'start-fresh';
  // With 'start-fresh': the only run the caller was told about and agreed to
  // replace. A different active run is reported instead of deleted.
  replaceRunId?: string;
  // Asked once init has decided to start a run, before any run is deleted or
  // any git side effect lands; false refuses.
  confirmStart?: () => Promise<boolean>;
}

export type OrchestratorInitResult =
  | {
      kind: 'ready';
      runId: string;
      runRoot: string;
      runbookPath: string;
      reconcileCommand: string;
    }
  // The exit-0 refusal: the runbook is missing and another nx wrote the run,
  // or the caller's confirmStart declined.
  | { kind: 'refused' }
  // The report: a run is already active and nothing was started.
  | { kind: 'existing-run'; runId: string; facts: ExistingRunFacts };

export interface RunOrchestratorResumeInput {
  root: string;
  runId: string;
  policy: MigrateRunPolicy;
  emitAgentInstructions?: boolean;
}

export interface RunOrchestratorReconcileInput {
  root: string;
  runId: string;
  stepAction?: StepAction;
}

const INIT_CONTINUE_HINT =
  're-run the command, or unset NX_MIGRATE_ORCHESTRATOR to use the standard migrate flow.';

function continueRunHint(runId: string): string {
  return `re-run the command to continue run '${runId}'.`;
}

// Refuses to proceed when the run's `git add -A` commits could sweep in the
// scratch under .nx/migrate-runs. Only commit-creating runs probe: without
// commits the worst case is git-status noise. Fails closed on an unusable
// probe: createCommits reaching the orchestrator means git was a repository
// at resolution time (resolveCreateCommits), so an unusable git here is an
// anomaly, and proceeding would risk absorbing run state into commits, where
// a later retry-clean `git reset --hard` could roll the tracked state back
// to a stale snapshot.
function assertScratchDirSafeForCommits(root: string, thenWhat: string): void {
  refuseUnsafeScratchExposure(
    getPathCommitExposure(MIGRATE_RUNS_RELATIVE_DIR, root),
    thenWhat
  );
}

function refuseUnsafeScratchExposure(
  exposure: PathCommitExposure,
  thenWhat: string
): void {
  switch (exposure) {
    case 'ignored':
      return;
    case 'tracked':
      throw new Error(
        `Files under ${MIGRATE_RUNS_RELATIVE_DIR} are committed to git, and ignore rules do not apply to tracked files, so migrate's commits would keep capturing this run's scratch state. ` +
          `Untrack them with \`git rm -r --cached ${MIGRATE_RUNS_RELATIVE_DIR}\`, commit that change, make sure .gitignore lists ${MIGRATE_RUNS_RELATIVE_DIR}, then ${thenWhat}`
      );
    case 'unignored':
      throw new Error(
        `${MIGRATE_RUNS_RELATIVE_DIR} is not ignored by git, so migrate's commits would capture this run's scratch state. ` +
          `Add a \`${MIGRATE_RUNS_RELATIVE_DIR}\` entry to .gitignore, then ${thenWhat}`
      );
    case 'unknown':
      throw new Error(
        `Could not verify with git that ${MIGRATE_RUNS_RELATIVE_DIR} is ignored, so migrate's commits could capture this run's scratch state. ` +
          `Make sure git is usable in this workspace, then ${thenWhat}`
      );
    default: {
      const exhaustive: never = exposure;
      throw new Error(`Unrecognized scratch exposure '${exhaustive}'.`);
    }
  }
}

export async function runOrchestratorInit(
  input: RunOrchestratorInitInput
): Promise<OrchestratorInitResult> {
  const {
    root,
    migrationsJson,
    migrationsPath,
    createCommits,
    commitPrefix,
    skipInstall,
    installedNxVersion,
    validate,
    emitAgentInstructions = true,
    onExistingRun = 'report',
    replaceRunId,
    confirmStart,
  } = input;
  const migrations = (migrationsJson.migrations ?? []) as PlannedMigration[];
  const sorted = sortMigrations(migrations.slice(), {
    hoistHandoffGitignore: true,
  });
  const plannedIds = sorted.map((m) => `${m.package}:${m.name}`);

  // An active run means a prior init already happened (e.g. it crashed before
  // the agent's first reconcile); starting a second run would compete with it,
  // and whether to continue it or replace it is the user's call, not a guess
  // from the plans. Reported before the migration id check below: this plan
  // is not being started. NewerRunStateFormatError propagates.
  const active =
    onExistingRun === 'start-fresh'
      ? activeRunToReplace(root, replaceRunId)
      : findActiveRunForInit(root);
  if (
    active &&
    (onExistingRun === 'report' ||
      (replaceRunId !== undefined && active.runId !== replaceRunId))
  ) {
    return reportExistingRun(
      root,
      active.runId,
      active.state,
      plannedIds,
      migrationsPath,
      emitAgentInstructions,
      replaceRunId
    );
  }
  // Held through confirmStart so a concurrent start-fresh cannot delete the
  // run while the user is asked. The refusals run here first, before the
  // prompt, the .gitignore fallback and the checkpoint; the locked pass below
  // is authoritative. Skipped without the scratch dir: the lock would create it.
  if (active) {
    holdRunActivity(root, active.runId);
  }
  if (existsSync(migrateRunsDir(root))) {
    withRunCreationLock(root, () => {
      refuseLiveReservation(root);
      if (active) {
        refuseUndeletableRun(root, active.runId, active.state);
      }
    });
  }

  // Dispensed commands interpolate migration ids verbatim, so every init
  // validates the incoming plan's ids. Before the delete below: a run must
  // not be thrown away for a plan that cannot start.
  for (const id of plannedIds) {
    if (!SHELL_SAFE_VALUE.test(id)) {
      throw new Error(
        `The migration id '${id}' contains characters that are not shell-safe. Orchestrated runs require shell-safe migration ids.`
      );
    }
  }

  if (confirmStart && !(await confirmStart())) {
    return { kind: 'refused' };
  }

  const runId = createRunId();
  const dir = runDir(root, runId);
  // Probe before any git side effect: the checkpoint below is a `git add -A`
  // commit, so on a workspace where scratch is committable it would sweep in
  // prior runs' directories and manufacture the very tracked state the probe
  // refuses. Missing ignore coverage alone is not refused yet, because the
  // fallback below may still add the entry. 'ignored' also stands in for
  // "no hazard" when commits are off.
  const scratchExposure: PathCommitExposure = createCommits
    ? getPathCommitExposure(MIGRATE_RUNS_RELATIVE_DIR, root)
    : 'ignored';
  if (scratchExposure !== 'unignored') {
    refuseUnsafeScratchExposure(scratchExposure, INIT_CONTINUE_HINT);
  }
  // Applied before the checkpoint so the entry (when it can be added) already
  // covers older scratch by the time the checkpoint's `git add -A` runs; the
  // fallback's standalone commit is suppressed because that checkpoint
  // carries the edit. Unlike the classic loop, a planned ignore migration
  // can't be deferred to: the run dir is created below, before that
  // migration runs.
  await applyAgenticHandoffGitignoreFallback({
    migrations: sorted,
    installedNxVersion,
    effectiveCreateCommits: createCommits,
    commitPrefix,
    root,
    applyWhenPlanned: true,
    commitStandalone: false,
  });
  if (scratchExposure === 'unignored') {
    // The fallback was the workspace's last chance at ignore coverage;
    // refuse when it could not add the entry (v23+ conscious removal, no
    // .gitignore, Lerna without nx.json).
    refuseUnsafeScratchExposure(
      getPathCommitExposure(MIGRATE_RUNS_RELATIVE_DIR, root),
      INIT_CONTINUE_HINT
    );
  }
  // One creation-lock section: two inits cannot both create a run, and a
  // start-fresh's delete and the new directory's reservation (no run.json
  // yet) land together. Git stays outside the lock: a hook re-entering nx
  // migrate would wait on this process. The .gitignore fallback is idempotent.
  let deleted = false;
  const reserved = withRunCreationLock(root, () => {
    refuseLiveReservation(root);
    const nowActive = findActiveRunForInit(root, active !== null);
    if (nowActive && nowActive.runId !== active?.runId) {
      return nowActive;
    }
    if (active) {
      // Completed meanwhile (a reconcile finished it): nothing to replace.
      if (!nowActive) {
        throw new Error(noActiveRunToReplace(active.runId));
      }
      deleted = deleteRunRecord(root, active.runId);
    }
    // The snapshot must exist before run.json makes the run discoverable: a
    // crash in between must not leave an active run without its plan.
    mkdirSync(dir, { recursive: true });
    writeJsonFile(join(dir, PLAN_SNAPSHOT_0), migrationsJson);
    // Held from here until run.json is written below and past it: a run must
    // never be discoverable, or reserved, without a holder.
    registerRunActivity(dir);
    return null;
  });
  if (reserved) {
    // A run created concurrently since the check above. Reported, not
    // deleted, even under 'start-fresh': that consent covered the run the
    // user saw, not one that appeared while this init was running.
    return reportExistingRun(
      root,
      reserved.runId,
      reserved.state,
      plannedIds,
      migrationsPath,
      emitAgentInstructions
    );
  }
  if (deleted) {
    removeDeletedRunDir(root, active.runId);
  }
  // Checkpoint pre-existing working-tree state BEFORE run.json exists, so a
  // clean tree stays uncommitted (writing run.json would otherwise dirty it
  // and fire a spurious checkpoint). A crash between here and createRun
  // leaves the committed changes orphaned but never lost, and the reserved
  // directory unlocked, which discovery ignores; the next init re-checkpoints
  // a now-clean tree as a no-op.
  const checkpoint = createCommits ? checkpointEntry(root, commitPrefix) : null;
  // The preflight checkpoint swallows its own failures, so the tree itself is
  // the only reliable signal: anything still uncommitted here predates every
  // step's gitRefBefore and rules out clean retries for the whole run. A
  // failed probe counts as dirty: mistaking it for clean would let a later
  // retry-clean reset destroy the very work this flag exists to protect.
  const checkpointFailed =
    createCommits && getWorkingTreeStatus(root) !== 'clean';
  const branch = getGitCurrentBranch(root);
  const state: MigrateRunState = {
    formatVersion: CURRENT_RUN_STATE_FORMAT_VERSION,
    runId,
    createdAt: nowIso(),
    nxVersion,
    status: 'active',
    createCommits,
    commitPrefix,
    ...(skipInstall ? { skipInstall: true } : {}),
    validate: validate !== false,
    runbookPath: RUNBOOK_FILE_NAME,
    ...(branch ? { branch } : {}),
    rounds: [
      {
        index: 0,
        planSnapshot: PLAN_SNAPSHOT_0,
      },
    ],
    steps: buildSteps(sorted),
    commits: checkpoint ? [checkpoint] : [],
    ...(checkpointFailed ? { checkpointFailed: true } : {}),
    analytics: { startEmitted: false, completeEmitted: false },
  };
  withRunCreationLock(root, () => {
    // The runbook gets the snapshot's crash guarantee: a discoverable run
    // always has the runbook a resume re-emits from disk. 'wx' creates
    // without following links, so nothing pre-planted at the path can
    // redirect it.
    writeFileSync(
      join(dir, RUNBOOK_FILE_NAME),
      renderRunbook(runbookContext(root, runId, state)),
      { flag: 'wx' }
    );
    createRun(root, state);
  });

  return finishInit(root, dir, runId, state, 'created', emitAgentInstructions);
}

/**
 * Continues the active run `runId` names: the `--run-migrations --run-id`
 * shape on both paths. Refuses as holdRunToContinue does.
 */
export function runOrchestratorResume(
  input: RunOrchestratorResumeInput
): OrchestratorInitResult {
  const { root, runId, policy, emitAgentInstructions = true } = input;
  const state = holdRunToContinue(root, runId);
  return resumeRun(root, runId, state, policy, emitAgentInstructions);
}

/**
 * Holds the active run `runId` names and returns its state. A continue calls
 * this before the install and the agent selection: a concurrent start-fresh
 * must not delete the run meanwhile. Throws when the id names no run or a
 * finished one, and while another process holds the run: continuing would
 * open a second session over a live one. Under WASM nothing is held and no
 * holder refuses.
 */
export function holdRunToContinue(
  root: string,
  runId: string
): MigrateRunState {
  if (!RUN_ID_SAFE.test(runId)) {
    throw new Error(`Invalid run id '${runId}'.`);
  }
  const dir = runDir(root, runId);
  if (!hasRunState(dir)) {
    throw new Error(
      `No migrate run '${runId}' was found under ${MIGRATE_RUNS_RELATIVE_DIR}.`
    );
  }
  const state = readRunState(dir);
  if (state.status !== 'active') {
    throw new Error(
      `Migrate run '${runId}' is already complete; there is nothing to continue.`
    );
  }
  holdRunActivity(root, runId, true);
  return state;
}

// The active run a start-fresh naming `runId` finds, read-only: init's first
// check, which the CLI also runs before the install. None refuses, since a
// completed run means the plan already ran. A different active run is returned
// too: init reports it instead of deleting it.
export function activeRunToReplace(
  root: string,
  runId: string | undefined
): { runId: string; state: MigrateRunState } {
  if (runId !== undefined && !RUN_ID_SAFE.test(runId)) {
    throw new Error(`Invalid run id '${runId}'.`);
  }
  const active = findActiveRunForInit(root, true);
  if (!active) {
    throw new Error(noActiveRunToReplace(runId));
  }
  return active;
}

/**
 * Drops the hold holdRunToContinue took, for a wrapper that hands the
 * continue to the workspace-local nx: the child takes its own hold, and an
 * exclusive one refuses while this process still holds.
 */
export function releaseRunToHandOff(root: string, runId: string): void {
  releaseRunActivity(runDir(root, runId));
}

// Reads the newest active run; null when no run is active. Uninterpretable
// run dirs refuse a fresh start (one of them could be an active run this
// init would compete with) but only warn when a healthy active run is found,
// unless `refuseUninterpretable`: a start-fresh would delete that run and
// then find only the unreadable ones. NewerRunStateFormatError propagates
// from the read.
function findActiveRunForInit(
  root: string,
  refuseUninterpretable = false
): { runId: string; state: MigrateRunState } | null {
  const { active, uninterpretable } = findActiveRun(root);
  if (uninterpretable.length > 0) {
    const noun = uninterpretable.length === 1 ? 'directory' : 'directories';
    // A directory name is whatever is on disk and a reason quotes what it
    // found, so neither can be trusted to stay on the line it is put on.
    // Sanitized here rather than left to the gateway: these same lines are
    // joined into the throw below, which leaves through handleErrors.
    const details = uninterpretable.map(
      (u) =>
        `${MIGRATE_RUNS_RELATIVE_DIR}/${singleLine(u.dirName)}: ${singleLine(
          u.reason
        )}`
    );
    if (!active || refuseUninterpretable) {
      throw new Error(
        [
          `Whether a migrate run is still active could not be determined; starting a new run could re-apply migrations an unfinished run already applied.`,
          ...details,
          `Fix or remove the listed ${noun}, then re-run the command.`,
        ].join('\n')
      );
    }
    warnToAgent({
      title: `Ignoring ${uninterpretable.length} migrate run ${noun} that could not be read.`,
      bodyLines: details,
    });
  }
  return active;
}

// A run directory without run.json but with a live activity lock is an init
// between reserving the directory and writing run.json: the checkpoint commit
// is in flight and no run may start alongside it. Refused at once, never
// waited for: a git hook re-entering nx migrate during that commit would
// otherwise wait on the process waiting for the hook. An unlocked one is the
// remains of an init that died, which discovery ignores like any other
// directory without run.json. Call under the creation lock.
function refuseLiveReservation(root: string): void {
  for (const entry of readdirSync(migrateRunsDir(root), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue;
    const dir = join(migrateRunsDir(root), entry.name);
    if (hasRunState(dir) || !hasAnyLiveRunActivity(dir)) continue;
    throw new Error(
      `Another nx migrate process is starting a run (${MIGRATE_RUNS_RELATIVE_DIR}/${singleLine(
        entry.name
      )}). Wait for it to finish, then re-run the command.`
    );
  }
}

// The report for an init that found a run already active. On the agent path
// the report and both ways forward go to stdout, in a block of its own kind:
// an `error` block would read as a crash, and this is a decision for the
// user. Held before the facts are read: a concurrent start-fresh must not
// delete the run under the report or the prompt after it.
function reportExistingRun(
  root: string,
  runId: string,
  state: MigrateRunState,
  plannedIds: readonly string[],
  migrationsPath: string | undefined,
  emitAgentInstructions: boolean,
  replaceRunId?: string
): OrchestratorInitResult {
  holdRunActivity(root, runId);
  const facts = collectExistingRunFacts(root, runId, state, plannedIds);
  if (replaceRunId !== undefined) {
    facts.replacedRunId = replaceRunId;
  }
  reportMigrateOrchestratorExistingRun({
    ...runTallies(state),
    activity:
      facts.otherHolders === 'unknown'
        ? 'unknown'
        : facts.otherHolders.length > 0
          ? 'held'
          : 'idle',
  });
  if (emitAgentInstructions) {
    const report = renderExistingRunReport(
      facts,
      renderExistingRunCommands(root, facts, migrationsPath)
    );
    logToAgent(report);
    const lines = safeLines([
      report.title,
      ...report.bodyLines,
      ``,
      `No migration step ran in this response. Show this report to the user and let them choose; run neither command until they do.`,
    ]);
    emitStepBlock(runId, '-', 'existing-run', {
      instructions: lines.join('\n'),
    });
  }
  return { kind: 'existing-run', runId, facts };
}

// Throws when the run's record must not be deleted: a worker the run
// dispensed or another nx migrate process is still acting on it, or another
// run is active alongside it and would be reported in place of the
// replacement. `state` is the run state the worker check reads.
function refuseUndeletableRun(
  root: string,
  runId: string,
  state: MigrateRunState
): void {
  if (IS_WASM) {
    throw new Error(
      `Not deleting migrate run '${runId}': without a native file lock nx cannot tell whether another nx migrate process is acting on it. Make sure none is, remove ${MIGRATE_RUNS_RELATIVE_DIR}/${runId}, then re-run the command.`
    );
  }
  const holders = liveRunActivityPids(runDir(root, runId));
  if (holders === 'unknown' || holders.length > 0) {
    throw heldRunError('deleting', runId, holders);
  }
  const workers = liveWorkers(state);
  if (workers.length > 0) {
    throw new Error(
      `Not deleting migrate run '${runId}': ${workersLine(workers)}. ` +
        `Wait for it to finish, then re-run the command. If that pid is not an nx migrate worker, stop it or remove ${MIGRATE_RUNS_RELATIVE_DIR}/${runId}, then re-run the command.`
    );
  }
  const others = findActiveRun(root).activeRunIds.filter((id) => id !== runId);
  if (others.length > 0) {
    throw new Error(
      `Not deleting migrate run '${runId}': other migrate runs are active on disk (${others.join(
        ', '
      )}), and a new run cannot start alongside them. Remove ${MIGRATE_RUNS_RELATIVE_DIR}/<run id> for each one that should not be continued, then re-run the command.`
    );
  }
}

function noActiveRunToReplace(runId: string | undefined): string {
  return `Not starting fresh: ${
    runId === undefined ? 'no migrate run' : `no migrate run '${runId}'`
  } is active, so there is nothing to replace. To start a run, re-run the command without --start-fresh and --run-id.`;
}

// Removes run.json under the state lock, so no reconcile or worker can start
// against a directory about to disappear. The refusals run again on fresh
// state: the early pass predates the prompt. False when already gone.
function deleteRunRecord(root: string, runId: string): boolean {
  const dir = runDir(root, runId);
  return withRunStateLock(dir, () => {
    if (!hasRunState(dir)) return false;
    refuseUndeletableRun(root, runId, readRunState(dir));
    // The hold's lock file is inside the directory removeDeletedRunDir removes.
    releaseRunActivity(dir);
    rmSync(join(dir, RUN_STATE_FILE_NAME), { force: true });
    return true;
  });
}

// The rest of a deleted run's directory, removed outside the locks and best
// effort: what is left holds no run.
function removeDeletedRunDir(root: string, runId: string): void {
  try {
    rmSync(runDir(root, runId), { recursive: true, force: true });
  } catch (e) {
    warnToAgent({
      title: `Could not remove the rest of ${MIGRATE_RUNS_RELATIVE_DIR}/${runId}: ${summarizeError(e)}. It no longer holds a run; remove it when convenient.`,
    });
  }
  logToAgent({ title: `Deleted the record of migrate run ${runId}.` });
}

// The continue tail behind runOrchestratorResume: the runbook, checkpoint and
// analytics steps a paused run needs before it can be driven again.
function resumeRun(
  root: string,
  runId: string,
  state: MigrateRunState,
  policy: MigrateRunPolicy,
  emitAgentInstructions: boolean
): OrchestratorInitResult {
  // Refused before the checkpoint retry below, which commits.
  if (
    state.createCommits !== policy.createCommits ||
    (state.skipInstall === true) !== policy.skipInstall
  ) {
    throw new Error(
      `Nx did not resume the active migrate run because its recorded install and commit policy differs from this invocation's. ` +
        `Nx takes that policy from --create-commits and --skip-install on the command line. ` +
        `Re-run with the flags run '${runId}' recorded (its report shows them). To start fresh, re-run with --start-fresh --run-id=${runId}, keeping the same --run-migrations[=<path>] argument used to start the run.`
    );
  }
  const dir = runDir(root, runId);
  // Ignore/index state can change while a durable run is paused (a checkout,
  // a .gitignore edit, a forced add). Probe before the checkpoint retry:
  // ensureCheckpoint is a `git add -A` commit, so on a workspace that became
  // unsafe it would absorb the run's own scratch.
  if (state.createCommits) {
    assertScratchDirSafeForCommits(root, continueRunHint(runId));
  }
  // Read, repair, or refuse the runbook before the checkpoint retry and the
  // analytics watermark: an invocation that cannot provide the run's
  // contract must not first change git history or durable run state.
  const runbook = ensureRunbook(root, dir, runId, state);
  if (runbook === null) {
    return { kind: 'refused' };
  }
  // A run flagged checkpointFailed gets one more chance to capture the
  // pre-existing tree state before its first migration commit absorbs it.
  const resumed = ensureCheckpoint(root, dir, state);
  announceResume(runId, resumed);
  return finishInit(
    root,
    dir,
    runId,
    resumed,
    'resumed',
    emitAgentInstructions,
    runbook
  );
}

function announceResume(runId: string, state: MigrateRunState): void {
  logToAgent({
    title: `nx migrate: resuming run ${runId}`,
    bodyLines: [
      `  started: ${state.createdAt}`,
      `  progress: ${progressLine(tallySteps(state))}`,
    ],
  });
}

// Resume-only checkpoint retry, gated on checkpointFailed: a fresh init always
// evaluates the checkpoint before run.json exists, so an unflagged run
// without a checkpoint entry started from a clean tree and there is nothing to
// capture (retrying there would commit the run's own scratch instead). Skipped
// once any migration step has advanced (a late checkpoint would absorb an
// already-run migration's changes).
function ensureCheckpoint(
  root: string,
  dir: string,
  state: MigrateRunState
): MigrateRunState {
  if (!state.createCommits || !state.checkpointFailed) return state;
  if (state.steps.some((s) => s.status !== 'pending')) return state;
  // Reserved so no step is dispensed into the tree the checkpoint captures;
  // a run that moved on since the snapshot has nothing left to capture.
  let lease: TreeLease;
  try {
    lease = acquireTreeOperation(dir, { kind: 'checkpoint' });
  } catch (e) {
    if (e instanceof BrokerStaleRequestError) return state;
    throw e;
  }
  try {
    // The checkpoint commit is a git side effect, so it runs before the lock;
    // the ledger append and flag clear then apply to the fresh on-disk state.
    const checkpoint = checkpointEntry(root, state.commitPrefix);
    // The retried checkpoint captured everything, so clean retries are safe
    // again. Only a verified-clean tree clears the flag: a failed probe proves
    // nothing was captured.
    const cleared = getWorkingTreeStatus(root) === 'clean';
    if (!checkpoint && !cleared) return state;
    return updateRunState(dir, (fresh) => {
      // Re-check both guards on the fresh state: a concurrent reconcile may
      // have cleared the flag or advanced a step while the commit ran.
      // Skipping here can leave that commit unledgered, the documented
      // crash-window shape.
      if (
        !fresh.checkpointFailed ||
        fresh.steps.some((s) => s.status !== 'pending')
      ) {
        return null;
      }
      const next = checkpoint ? appendCommit(fresh, checkpoint) : fresh;
      return cleared ? { ...next, checkpointFailed: false } : next;
    });
  } finally {
    lease.release();
  }
}

// Commits pre-existing working-tree state so the first migration's commit can't
// absorb it, returning the ledger entry only when a commit verifiably landed.
// A clean tree is a no-op. Failure detection is the caller's job: the commit
// helper swallows failures, so callers re-check the tree afterwards.
function checkpointEntry(
  root: string,
  commitPrefix: string
): MigrateCommitLedgerEntry | null {
  // Skip only on a verified-clean tree; on a failed probe the commit attempt
  // below re-probes and may succeed once the transient failure passes.
  if (getWorkingTreeStatus(root) === 'clean') {
    return null;
  }
  const before = getLatestCommitSha(root);
  commitCheckpointBeforeMigrations(root, commitPrefix);
  const after = getLatestCommitSha(root);
  if (after && after !== before) {
    return { kind: 'checkpoint', sha: after, stepIds: [] };
  }
  return null;
}

// No migration step is dispensed here: the agent reads the runbook first and
// asks for the run's current step by reconciling, so the contract always lands
// before the first command does.
function finishInit(
  root: string,
  dir: string,
  runId: string,
  state: MigrateRunState,
  origin: 'created' | 'resumed',
  emitAgentInstructions: boolean,
  // The runbook bytes when the caller already ensured them (the resume path,
  // which must fail before its git and state side effects).
  runbook?: string
): OrchestratorInitResult {
  let current = state;
  if (!current.analytics.startEmitted) {
    // Claim the watermark on the fresh state first: of two concurrent inits
    // exactly one flips it, and only that one reports.
    let claimed = false;
    current = updateRunState(dir, (fresh) => {
      if (fresh.analytics.startEmitted) return null;
      claimed = true;
      return {
        ...fresh,
        analytics: { ...fresh.analytics, startEmitted: true },
      };
    });
    if (claimed) {
      reportMigrateOrchestratorInit({
        migrationCount: current.steps.length,
        createCommits: current.createCommits,
      });
    }
  }
  if (origin === 'resumed') {
    reportMigrateOrchestratorResume(runTallies(current));
  }
  const content = runbook ?? ensureRunbook(root, dir, runId, current);
  if (content === null) {
    return { kind: 'refused' };
  }
  const ready: OrchestratorInitResult = {
    kind: 'ready',
    runId,
    runRoot: root,
    runbookPath: join(dir, current.runbookPath ?? RUNBOOK_FILE_NAME),
    reconcileCommand: reconcileCommand(root, runId),
  };
  if (!emitAgentInstructions) {
    return ready;
  }
  emitRunbookBlock(runId, content);
  const instructionLines = [
    `Nx ${origin} migrate run ${runId}. No migration step ran in this response.`,
    `Read the runbook above; it is the contract for driving this run. Then run the "next" command to get the run's current step.`,
    ...runbookFooterLines(root, runId),
  ];
  const lines = safeLines(instructionLines);
  logToAgent({ title: `nx migrate: run ${origin}`, bodyLines: lines });
  emitStepBlock(runId, '-', 'initialized', {
    next: ready.reconcileCommand,
    instructions: lines.join('\n'),
  });
  return ready;
}

// A missing runbook is re-rendered only by the nx version that created the
// run: its content is version-locked, and a different nx re-rendering it would
// silently hand the agent a contract the run was not created under. Returns
// null after emitting the exit-0 refusal instead.
function ensureRunbook(
  root: string,
  dir: string,
  runId: string,
  state: MigrateRunState
): string | null {
  const filePath = join(dir, state.runbookPath ?? RUNBOOK_FILE_NAME);
  const stat = lstatRunbook(filePath);
  if (stat?.isFile()) {
    // The read is the proof the entry is usable: read errors (an unreadable
    // mode, an I/O failure) propagate rather than letting an unreadable
    // runbook pass the guard.
    return readInspectedFile(
      filePath,
      stat,
      `${MIGRATE_RUNS_RELATIVE_DIR}/${runId}/${RUNBOOK_FILE_NAME} was replaced while being read; ${continueRunHint(
        runId
      )}`
    );
  }
  if (stat) {
    // A directory here is a corrupted run dir; erasing its contents as a side
    // effect of a reconcile is not this code's call to make.
    if (stat.isDirectory()) {
      throw new Error(
        `${MIGRATE_RUNS_RELATIVE_DIR}/${runId}/${RUNBOOK_FILE_NAME} is a directory, not the runbook file nx wrote there. Remove it, then ${continueRunHint(
          runId
        )}`
      );
    }
    // Any other non-regular entry (a symlink most likely) is cleared before the
    // rename publish below: POSIX rename replaces it in place, but not every
    // platform guarantees that, and a removal failure must propagate rather
    // than leave the entry standing.
    rmSync(filePath, { force: true });
  }
  if (state.nxVersion !== nxVersion) {
    const reason = [
      `The runbook for run '${runId}' is missing from ${MIGRATE_RUNS_RELATIVE_DIR}/${runId}, and this nx (${nxVersion}) cannot re-render the one nx ${singleLine(
        state.nxVersion
      )} wrote.`,
      `Restore the file (or, if the run was created before runbooks existed, re-run with the nx version that created it). To start fresh, re-run with --start-fresh --run-id=${runId}, keeping the same --run-migrations[=<path>] argument used to start the run.`,
    ];
    warnToAgent({ title: reason[0], bodyLines: [reason[1]] });
    emitStepBlock(runId, '-', 'error', {
      instructions: reason.join('\n'),
    });
    return null;
  }
  const content = renderRunbook(runbookContext(root, runId, state));
  // A crashed repair leaves the path missing rather than truncated. 'wx'
  // creates without following links, so anything planted at the temp name
  // fails the repair instead of redirecting it.
  publishFileAtomically(filePath, (tmpPath) =>
    writeFileSync(tmpPath, content, { flag: 'wx' })
  );
  updateRunState(dir, (fresh) =>
    fresh.runbookPath ? null : { ...fresh, runbookPath: RUNBOOK_FILE_NAME }
  );
  warnToAgent({
    title: `The runbook for run '${runId}' was missing; it has been re-rendered.`,
  });
  return content;
}

// lstat that treats only a missing entry as null; other inspection failures
// (permissions, I/O) propagate rather than masquerading as "missing". Bigint
// stats so the inode identity compared above cannot lose precision.
function lstatRunbook(filePath: string): BigIntStats | null {
  try {
    return lstatSync(filePath, { bigint: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return null;
    }
    throw e;
  }
}

function runbookContext(
  root: string,
  runId: string,
  state: MigrateRunState
): RunbookContext {
  return {
    runId,
    packageManager: detectPackageManager(root),
    nxInvocation: `${pmExecPrefix(root)} nx`,
    pmExec: pmExecPrefix(root),
    reconcileCommand: reconcileCommand(root, runId),
    createCommits: state.createCommits,
    // The same `!== false` read the flag itself gets, so a run recorded
    // without the field renders validation on.
    validate: state.validate !== false,
  };
}

// Only the newest recorded commit is checked, so the warning stops on its own
// once the next step commits on the new history; checking every ledger entry
// would repeat it on every reconcile after a rebase.
function warnIfHistoryRewound(
  root: string,
  runId: string,
  state: MigrateRunState
): void {
  const commits = recordedCommits(state);
  const newest = commits[commits.length - 1]?.sha;
  if (!newest) return;
  const head = getLatestCommitSha(root);
  if (!head || getAncestorStatus(newest, head, root) !== 'not-ancestor') {
    return;
  }
  const facts = collectExistingRunFacts(root, runId, state);
  warnToAgent({
    title: `The newest commit migrate run ${runId} recorded is not reachable from HEAD. Continuing the run as asked.`,
    bodyLines: renderExistingRunReport(facts).bodyLines,
  });
}

export async function runOrchestratorReconcile(
  input: RunOrchestratorReconcileInput
): Promise<void> {
  const { root, runId, stepAction } = input;
  if (!RUN_ID_SAFE.test(runId)) {
    throw new Error(`Invalid run id '${runId}'.`);
  }
  const dir = runDir(root, runId);
  if (!hasRunState(dir)) {
    // No remediation beyond the id: starting a run is a separate, gated entry
    // point, so pointing at it here would hand most callers a command that
    // does something else entirely.
    throw new Error(
      `No migrate run '${runId}' was found under ${MIGRATE_RUNS_RELATIVE_DIR}.`
    );
  }
  holdRunActivity(root, runId);
  // Version refusal (NewerRunStateFormatError) propagates.
  let state = readRunState(dir);
  warnIfHistoryRewound(root, runId, state);

  // Ignore/index state can change while a durable run is paused (a checkout,
  // a .gitignore edit, a forced add); re-verify before foldHandoffs, which
  // can itself commit a settled prompt step.
  if (state.createCommits) {
    assertScratchDirSafeForCommits(root, continueRunHint(runId));
  }

  // The runbook is the run's persisted contract; read, repair, or refuse it
  // before any fold or dispense, so the run can never advance while the
  // contract is unavailable. A completed run, and an active run whose steps are
  // all terminal, are exempt: no work can advance, the only thing left is the
  // self-contained terminal response, and hiding it behind a missing contract
  // would leave the run active forever.
  if (
    state.status !== 'completed' &&
    firstActionableStep(state) !== undefined &&
    ensureRunbook(root, dir, runId, state) === null
  ) {
    return;
  }

  // (a) fold handoffs into prompt outcomes (committing completed ones).
  state = await foldHandoffs(root, dir, state);
  // (b) reclassify running steps whose worker process is gone.
  state = detectDeaths(dir, state);
  // (c) apply the decision relay to the single failed/died step.
  if (stepAction) {
    // Owns the tree reservation a clean retry's reset, an adopt's commit, a
    // give-up or a skip's install takes, released once the transition that
    // records it is written.
    const scope: TreeScope = {};
    try {
      const result = await applyReconcileStepAction(
        root,
        dir,
        state,
        stepAction,
        scope
      );
      if (result.kind === 'error') {
        emitError(root, runId, result.reason);
        return; // no transition was written
      }
      const target = result.targetStep;
      // Unless a reset ran, give-up.ts commits the partial result under the
      // migration's name and settles the step in one operation; a failed
      // install or commit settles it with the debt recorded.
      if (
        stepAction === 'unresolved' &&
        state.createCommits &&
        !result.resetTree
      ) {
        const outcome = await giveUpStepTree(
          root,
          dir,
          target,
          state.skipInstall === true,
          reconcileCommand(root, runId),
          scope
        );
        if (outcome.kind === 'refused') {
          emitError(root, runId, outcome.reason);
          return;
        }
        warnAboutGiveUp(target, outcome);
        // Settled already; the dispense refuses a tree still held.
        scope.lease?.release();
        scope.lease = undefined;
        advanceAndDispense(root, dir, runId);
        return;
      }
      // The commit is a git side effect, so it runs before the lock (locked
      // sections stay synchronous); the transition and any unrecorded entry then
      // land in one write. Adopt and skip keep the tree, so the install they owe
      // runs here: the next dispense would take the changed deps as its baseline.
      // Giving up keeps it the same way when the run does not commit. Retries
      // owe nothing: the rearmed attempt reconciles itself.
      const { entry, installFailed, recorded } = await stepActionSideEffects(
        root,
        dir,
        state,
        target,
        stepAction,
        result.resetTree,
        scope
      );
      // A rearm starts a fresh attempt; drop the stale handoff before the rearm
      // is persisted so a crash in between can't refold the old outcome into the
      // new attempt. Losing the handoff without the rearm is safe: the step is
      // still failed/died and the agent re-issues the action.
      if (stepAction === 'retry' || stepAction === 'retry-clean') {
        removeHandoff(dir, target.id);
        // A reset-backed retry reruns the generator, so payloads from earlier
        // attempts describe a tree that was reset away. Hygiene only: the persisted
        // generatorCompletedAtAttempt bound is the correctness gate.
        if (
          stepAction === 'retry-clean' &&
          result.state.steps.find((s) => s.id === target.id)
            .generatorCompleted !== true
        ) {
          removeAgentWorkPayloads(dir, target.id, target.attempt);
        }
      }
      // Re-validate against fresh disk state so a concurrent reconcile's own
      // rejection surfaces through emitError instead of being written over. The
      // bound attempt keeps the snapshot checks above honest.
      let freshRejection: string | undefined;
      let unresolvedArchiveError: string | undefined;
      const written = updateRunState(dir, (fresh) => {
        // A plain retry takes no reservation of its own, so this is where it
        // learns that a live process still commits or installs for the step.
        const held = liveTreeOperation(fresh, scope.lease?.owner);
        if (held) {
          freshRejection = treeBusyMessage(held);
          return null;
        }
        // A plain retry's acceptance read the generator marker on the
        // snapshot; a clean retry that started meanwhile forgets the marker
        // without moving the attempt, so the attempt check cannot see it.
        const freshStep = fresh.steps.find((s) => s.id === target.id);
        if (
          stepAction === 'retry' &&
          freshStep !== undefined &&
          generatorPending(freshStep) !== generatorPending(target)
        ) {
          freshRejection = `Cannot apply action 'retry' to step '${target.id}': whether its generator ran changed since this reconcile read it. Run the reconcile again.`;
          return null;
        }
        const reapplied = applyStepEvent(fresh, {
          type: 'stepAction',
          stepId: target.id,
          action: stepAction,
          attempt: target.attempt,
        });
        if (reapplied.kind === 'error') {
          freshRejection = reapplied.reason;
          return null;
        }
        let settled = reapplied.state;
        // The unresolved status and its issue are persisted together.
        if (stepAction === 'unresolved') {
          const recorded = recordUnresolvedIssue(dir, settled, target.id);
          unresolvedArchiveError = recorded.archiveError;
          settled = recorded.state;
        }
        const next = installFailed
          ? markInstallFailed(settled, target.id)
          : settled;
        // An adopted commit absorbs uncovered failed steps the same way a fold
        // commit does, so it carries their resolved issues too. A session's
        // parent records its own commits as it answers.
        return entry && !recorded
          ? appendCommit(next, attachIssueIdsToCommitEntry(next, entry))
          : next;
      });
      if (freshRejection) {
        emitError(
          root,
          runId,
          entry?.kind === 'landed' && entry.sha
            ? `${freshRejection} Note: this action's commit ${entry.sha} had already landed and stays in history; resolve the step against the tree as it stands now.`
            : freshRejection
        );
        return;
      }
      if (unresolvedArchiveError !== undefined) {
        warnUnresolvedNotArchived(target.migrationId, unresolvedArchiveError);
      }
      state = written;
    } finally {
      scope.lease?.release();
    }
  }
  // (d) choose and emit the next dispense.
  advanceAndDispense(root, dir, runId);
}

function buildSteps(sortedMigrations: PlannedMigration[]): MigrateStep[] {
  return sortedMigrations.map((m, index) => ({
    id: `step-${index + 1}`,
    roundIndex: 0,
    migrationId: `${m.package}:${m.name}`,
    status: 'pending',
    attempt: 1,
    dispenseCount: 0,
    hasGenerator: !isPromptOnlyMigration(m),
  }));
}

async function foldHandoffs(
  root: string,
  dir: string,
  state: MigrateRunState
): Promise<MigrateRunState> {
  let current = state;
  // Step ids are fixed for the life of a run, so the ids come from the caller's
  // snapshot while every status read comes from `current`: each iteration can
  // have advanced the run.
  for (const { id } of state.steps) {
    const step = current.steps.find((s) => s.id === id);
    if (step.status !== 'awaiting-prompt-outcome') continue;
    const result = readStepHandoff(dir, step.id);
    if (!result.ok) continue; // still awaiting; the dispense asks to settle it
    let promptOutcome = handoffToPromptOutcome(result.handoff);
    // A skipped handoff completes a step whose generator changed the tree.
    // Prompt-only and no-op hybrid steps remain skipped so they cannot commit
    // unrelated pending diffs.
    if (generatorChangesApplied(step) && promptOutcome.status === 'skipped') {
      promptOutcome = { ...promptOutcome, status: 'completed' };
    }
    // Archive under the lock before committing or marking the step terminal.
    // Failure leaves the handoff retryable instead of landing an unrecorded
    // commit or a ledger entry without detail; replayed archive writes are
    // idempotent.
    let ready = false;
    let archiveError: unknown = null;
    const reconstructedIssueIds: string[] = [];
    withRunStateLock(dir, () => {
      const fresh = readRunState(dir);
      const applied = applyStepEvent(fresh, {
        type: 'foldPromptOutcome',
        stepId: step.id,
        attempt: step.attempt,
        promptOutcome,
      });
      if (applied.kind === 'error') return;
      // A corrupt receipt refuses the fold here, before the commit below
      // could land unrecorded.
      commitReceipt(
        fresh,
        fresh.steps.find((s) => s.id === step.id)
      );
      const issues = parseHandoffIssues(result.handoff.extras, fresh, step);
      if (issues.ok !== true) return;
      try {
        // The sink survives a throw: a shell rebuilt before the failure is
        // durable and reads healthy on the retry, so only this pass can
        // warn that its original detail is gone.
        archiveIssues(
          dir,
          applyReportedIssues(
            applied.state,
            step,
            issues.issues,
            issues.updates
          ),
          reconstructedIssueIds
        );
      } catch (e) {
        archiveError = e;
        return;
      }
      ready = true;
    });
    warnReconstructedArchives(reconstructedIssueIds);
    if (archiveError !== null) {
      warnToAgent({
        title: `The issue details reported by ${
          step.migrationId
        } could not be archived (${summarizeError(archiveError)}).`,
        bodyLines: [
          `The step's outcome was not folded; fix the underlying problem, then run the reconcile again.`,
        ],
      });
    }
    if (!ready) continue;
    // Phase 2: the commit and the install are side effects, so they run outside
    // the lock; the transition, the issue application and any unrecorded ledger
    // entry then land in one fresh-state write.
    let folded = false;
    let updateArchiveError: unknown = null;
    let detailArchiveError: unknown = null;
    let archivesDegraded = false;
    const refoldReconstructedIds: string[] = [];
    const scope: TreeScope = {};
    try {
      const { entry, installFailed, recorded } = await foldLedgerEntry(
        root,
        dir,
        current,
        step,
        promptOutcome,
        scope
      );
      // Bound to the attempt this handoff was read for: the window is wide (a
      // commit plus an install) and 'awaiting-prompt-outcome' recurs, so a
      // concurrent retry could otherwise take this outcome as its own. Under the
      // lock so the issue application re-archives on the state it lands on.
      current = withRunStateLock(dir, () => {
        const fresh = readRunState(dir);
        if (liveTreeOperation(fresh, scope.lease?.owner)) return fresh;
        const applied = applyStepEvent(fresh, {
          type: 'foldPromptOutcome',
          stepId: step.id,
          attempt: step.attempt,
          promptOutcome,
        });
        if (applied.kind === 'error') return fresh;
        const issues = parseHandoffIssues(result.handoff.extras, fresh, step);
        if (issues.ok !== true) return fresh;
        // A commit this process ran takes the handoff's resolutions when it is
        // appended below; otherwise the entry already recorded for this attempt
        // takes them, stamped at its index.
        const receipt = commitReceipt(
          applied.state,
          applied.state.steps.find((s) => s.id === step.id)
        );
        const carrier = entry && !recorded ? undefined : receipt;
        const application = applyReportedIssues(
          applied.state,
          step,
          issues.issues,
          issues.updates,
          carrier?.index
        );
        try {
          // Phase 1 wrote these files, so a reconstruction here means one
          // vanished between the phases; the ids surface that loss. The sink
          // survives a throw, so a shell rebuilt before a later batch failed
          // still gets warned.
          archiveIssues(dir, application, refoldReconstructedIds);
        } catch (e) {
          // A landed commit outranks the drop: refolding would re-attempt
          // its commit against a clean tree as no-changes and lose the entry
          // for good. Phase 1 already archived this handoff's records durably
          // once; the fold proceeds and the loss is warned.
          const intact = applicationArchivesIntact(dir, application);
          if (entry?.kind !== 'landed' && intact !== true) {
            detailArchiveError = e;
            return fresh;
          }
          updateArchiveError = e;
          archivesDegraded = intact !== true;
        }
        folded = true;
        let next = installFailed
          ? markInstallFailed(application.state, step.id)
          : application.state;
        // A landed commit carries the fixes of every issue resolved by a step it
        // names, absorbed steps included.
        if (carrier) next = enrichCommitEntryIssueIds(next, carrier.index);
        const written =
          entry && !recorded
            ? appendCommit(next, attachIssueIdsToCommitEntry(next, entry))
            : next;
        writeRunState(dir, written);
        return written;
      });
    } finally {
      scope.lease?.release();
    }
    // The written state still names the lease just released; the caller's
    // own reservation checks must not read it as another process's hold.
    if (scope.lease) current = readRunState(dir);
    warnReconstructedArchives(refoldReconstructedIds);
    if (detailArchiveError !== null) {
      warnToAgent({
        title: `The issue details reported by ${
          step.migrationId
        } could not be archived (${summarizeError(detailArchiveError)}).`,
        bodyLines: [
          `The step's outcome was not folded; fix the underlying problem, then run the reconcile again.`,
        ],
      });
    }
    if (updateArchiveError !== null) {
      warnToAgent(
        archivesDegraded
          ? {
              title: `Some issue transition records for ${
                step.migrationId
              } could not be archived (${summarizeError(updateArchiveError)}).`,
              bodyLines: [
                `run.json stays authoritative for the dispositions; the archived files under the run's issues directory are missing or incomplete for this fold's issues, and its landed commit takes precedence over retrying the archive.`,
              ],
            }
          : {
              title: `Re-archiving the issue records for ${
                step.migrationId
              } failed (${summarizeError(updateArchiveError)}).`,
              bodyLines: [
                `Nothing was lost: the fold's records were verified on disk and recorded in run.json. The failed write may point at a disk problem worth checking.`,
              ],
            }
      );
    }
    // A rejected fold leaves the handoff in place: it belongs to whichever
    // attempt is on disk now, and that attempt's own reconcile still has to
    // read it. The stored agent-work payloads go with a terminal outcome; a
    // failed fold keeps them, since a retry re-hands the newest surviving copy.
    if (folded) {
      removeHandoff(dir, step.id);
      if (promptOutcome.status !== 'failed') {
        removeAgentWorkPayloads(dir, step.id, step.attempt);
      }
    }
  }
  return current;
}

// What a folded prompt outcome owes the run state. Only a completed prompt
// with commits on rides its install in on the commit path; every other
// outcome installs here, or the next dispense takes the unreconciled
// package.json edit as its own baseline. A tree that is not verifiably clean
// records debt; a failed probe counts as dirty.
async function foldLedgerEntry(
  root: string,
  dir: string,
  state: MigrateRunState,
  step: MigrateStep,
  promptOutcome: MigrateStepPromptOutcome,
  scope: TreeScope
): Promise<StepSideEffects> {
  if (promptOutcome.status === 'completed') {
    if (state.createCommits) {
      return commitForStep(root, dir, state, step, scope);
    }
    return {
      entry: null,
      installFailed: await installFailedForStep(
        root,
        dir,
        state,
        step,
        'fold-install',
        scope
      ),
    };
  }
  return retainedTreeSideEffects(root, dir, state, step, 'fold-install', scope);
}

// Shared by prompts that did not complete and by skipped failed or died steps:
// the tree is kept as it stands, so the step still owes the install of any
// dependency edits it left and, with commits on, a debt record when the tree
// is not verifiably clean (see foldLedgerEntry for why).
async function retainedTreeSideEffects(
  root: string,
  dir: string,
  state: MigrateRunState,
  step: MigrateStep,
  seam: InstallSeam,
  scope: TreeScope
): Promise<StepSideEffects> {
  const installFailed = await installFailedForStep(
    root,
    dir,
    state,
    step,
    seam,
    scope
  );
  const entry =
    state.createCommits && getWorkingTreeStatus(root) !== 'clean'
      ? { kind: 'failed' as const, stepIds: [step.id] }
      : null;
  return { entry, installFailed };
}

// Installs the dependency changes a step's tree may carry when no commit path
// will, returning whether the install failed. A failure is recorded rather
// than thrown: reconcile still owes the agent a dispense. Broker errors do
// throw, as in commitForStep: the next reconcile redoes the action.
async function installFailedForStep(
  root: string,
  dir: string,
  state: MigrateRunState,
  step: MigrateStep,
  seam: InstallSeam,
  scope: TreeScope
): Promise<boolean> {
  const skipInstall = state.skipInstall === true;
  try {
    await installStepTree(
      dir,
      step,
      seam,
      () =>
        installDepsChangedSinceDispense(
          root,
          dir,
          step,
          skipInstall,
          reconcileCommand(root, state.runId)
        ),
      scope
    );
    return false;
  } catch (e) {
    if (
      e instanceof BrokerStaleRequestError ||
      e instanceof BrokerUnavailableError ||
      e instanceof TreeBusyError
    ) {
      throw e;
    }
    warnToAgent({
      title: `The dependencies changed by ${step.migrationId} could not be installed (${summarizeError(
        e
      )}).`,
      bodyLines: [`Run \`${pmInstallCommand(root)}\` before continuing.`],
    });
    return true;
  }
}

// A failed handoff fails the prompt; a success handoff completes it, unless it
// marks the prompt not applicable via `extras.outcome === 'skipped'`.
function handoffToPromptOutcome(
  handoff: HandoffFile
): MigrateStepPromptOutcome {
  if (handoff.status === 'failed') {
    return { status: 'failed', summary: handoff.summary };
  }
  if (handoff.extras && handoff.extras['outcome'] === 'skipped') {
    return { status: 'skipped', summary: handoff.summary };
  }
  return { status: 'completed', summary: handoff.summary };
}

function detectDeaths(dir: string, state: MigrateRunState): MigrateRunState {
  let current = state;
  // As in foldHandoffs: ids from the caller's snapshot, statuses from
  // `current`, so an earlier iteration's write is visible to the next.
  for (const { id } of state.steps) {
    const step = current.steps.find((s) => s.id === id);
    if (step.status !== 'running') continue;
    if (step.pid === undefined || isPidAlive(step.pid)) continue;
    // markDied re-validates against fresh disk state, on the attempt and pid
    // this observation was made for: if the worker finished between the
    // snapshot and the write, or a retry already put a live worker on the
    // step, the transition is rejected and the step is left as recorded.
    current = updateRunState(dir, (fresh) => {
      // A dead worker's commit or install may still be running in the
      // session's parent; the step stays running until that lands.
      if (liveTreeOperation(fresh)) return null;
      const applied = applyStepEvent(fresh, {
        type: 'markDied',
        stepId: step.id,
        attempt: step.attempt,
      });
      return applied.kind === 'ok' ? applied.state : null;
    });
  }
  return current;
}

async function applyReconcileStepAction(
  root: string,
  dir: string,
  state: MigrateRunState,
  action: StepAction,
  scope: TreeScope
): Promise<
  | {
      kind: 'ok';
      state: MigrateRunState;
      targetStep: MigrateStep;
      // True when the give-up reset the tree and it verified clean.
      resetTree: boolean;
    }
  | { kind: 'error'; reason: string }
> {
  const candidates = state.steps.filter(
    (s) => s.status === 'failed' || s.status === 'died'
  );
  if (candidates.length === 0) {
    return {
      kind: 'error',
      reason: `No step is failed or died, so there is nothing for --step-action=${action} to target.`,
    };
  }
  if (candidates.length > 1) {
    return {
      kind: 'error',
      reason: `More than one step is failed or died; --step-action targets exactly one. Resolve them one at a time.`,
    };
  }
  const step = candidates[0];
  const held = liveTreeOperation(state);
  if (held) {
    return { kind: 'error', reason: treeBusyMessage(held) };
  }
  if (
    (action === 'retry' || action === 'retry-clean') &&
    rearmCapReached(step)
  ) {
    return {
      kind: 'error',
      reason: `Cannot apply action '${action}' to step '${step.id}': ${rearmCapLine(
        step,
        commitMayBeInHistory(state, step)
      )}`,
    };
  }
  // A retry-clean the dispense would not have offered must be refused here
  // too, or a hand-crafted reconcile could reset a tree with no restore point
  // and destroy prior steps' work.
  if (action === 'retry-clean') {
    const head = getLatestCommitSha(root);
    const fallback = `Use ${actionList([
      ...(step.status === 'died' ? [] : ['retry']),
      'adopt',
      ...(commitMayBeInHistory(state, step) ? [] : ['skip', 'unresolved']),
    ])} instead.`;
    if (!canOfferCleanRetry(root, state, step, head)) {
      return {
        kind: 'error',
        reason: `Cannot apply action 'retry-clean' to step '${
          step.id
        }': ${cleanRetryUnavailableReason(root, state, step, head)} ${fallback}`,
      };
    }
    // Reset under the reservation: the checks above ran on a snapshot, and
    // resetForCleanRetry re-checks against the state read once it is held.
    try {
      await resetStepTree(
        dir,
        step,
        () => resetForCleanRetry(root, dir, step.id),
        scope
      );
    } catch (e) {
      if (
        e instanceof BrokerStaleRequestError ||
        e instanceof BrokerUnavailableError ||
        e instanceof TreeBusyError
      ) {
        throw e;
      }
      return {
        kind: 'error',
        reason: `Cannot apply action 'retry-clean' to step '${step.id}': the reset to ${step.gitRefBefore} failed: ${e instanceof Error ? e.message : String(e)} ${fallback}`,
      };
    }
    // Only the tree can say whether the reset left it clean. Anything else is
    // refused: accepting would rearm a step whose next attempt reruns the
    // generator over the previous attempt's output.
    if (getWorkingTreeStatus(root) !== 'clean') {
      return {
        kind: 'error',
        reason: `Cannot apply action 'retry-clean' to step '${step.id}': the working tree is not verifiably clean after the reset to ${step.gitRefBefore}. Inspect it with \`git status\`, then re-run it. ${fallback}`,
      };
    }
  }
  // Giving up discards what a generator that never completed left behind
  // when the same restore point a clean retry needs exists, through the same
  // reserved reset. When there is no such point the tree is kept: what an
  // agent authored is never discarded, and a reset here would have no
  // verified target.
  const resetTree =
    action === 'unresolved' &&
    unresolvedResetsTree(
      state,
      step,
      canOfferCleanRetry(root, state, step, getLatestCommitSha(root))
    );
  if (resetTree) {
    try {
      await resetStepTree(
        dir,
        step,
        () => resetForCleanRetry(root, dir, step.id),
        scope
      );
    } catch (e) {
      if (
        e instanceof BrokerStaleRequestError ||
        e instanceof BrokerUnavailableError ||
        e instanceof TreeBusyError
      ) {
        throw e;
      }
      return {
        kind: 'error',
        reason: `Cannot apply action 'unresolved' to step '${step.id}': the reset to ${step.gitRefBefore} failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
    if (getWorkingTreeStatus(root) !== 'clean') {
      return {
        kind: 'error',
        reason: `Cannot apply action 'unresolved' to step '${step.id}': the working tree is not verifiably clean after the reset to ${step.gitRefBefore}. Inspect it with \`git status\`, then re-run it.`,
      };
    }
  }
  // A failed generator can have written to the tree before throwing, and a
  // plain retry reruns it, so a pre-marker retry is accepted only when git
  // can see nothing of the failed attempt in the tree. The state machine is
  // pure and cannot read the tree, which is why the gate lives here.
  if (
    action === 'retry' &&
    step.status === 'failed' &&
    generatorPending(step)
  ) {
    const safety = assessPreMarkerRetry(root, step);
    if (safety.kind === 'unsafe') {
      return {
        kind: 'error',
        reason: `Cannot apply action 'retry' to step '${step.id}': ${safety.reason} Use 'retry-clean' where offered${
          commitMayBeInHistory(state, step) ? '' : `, 'skip' or 'unresolved'`
        }, or 'adopt'.`,
      };
    }
    if (safety.kind === 'warned') {
      warnToAgent({
        title: `Retrying ${step.migrationId} without verification`,
        bodyLines: [safety.warning],
      });
    }
  }
  const applied = applyStepEvent(state, {
    type: 'stepAction',
    stepId: step.id,
    action,
    attempt: step.attempt,
  });
  if (applied.kind === 'error') {
    return applied;
  }
  return { kind: 'ok', state: applied.state, targetStep: step, resetTree };
}

function actionList(actions: string[]): string {
  const quoted = actions.map((a) => `'${a}'`);
  return quoted.length === 1
    ? quoted[0]
    : `${quoted.slice(0, -1).join(', ')} or ${quoted[quoted.length - 1]}`;
}

// The reset runs before the transition, so it is withheld where the
// transition refuses the give-up.
function unresolvedResetsTree(
  state: MigrateRunState,
  step: MigrateStep,
  cleanRetry: boolean
): boolean {
  return (
    generatorPending(step) && !commitMayBeInHistory(state, step) && cleanRetry
  );
}

// What a reconcile's git and install side effects owe the run state, applied
// in the same locked write as the step transition they belong to. The two are
// independent: a step can be committed with its dependencies uninstalled, and
// the ledger says nothing about the latter.
interface StepSideEffects {
  entry: MigrateCommitLedgerEntry | null;
  installFailed: boolean;
  // The session's parent ran the commit and already recorded `entry`.
  recorded?: boolean;
}

// Git and install side effects run here, before the transition and outside the
// synchronous state lock.
async function stepActionSideEffects(
  root: string,
  dir: string,
  state: MigrateRunState,
  step: MigrateStep,
  action: StepAction,
  resetTree: boolean,
  scope: TreeScope
): Promise<StepSideEffects> {
  switch (action) {
    case 'adopt':
      // A died worker's unrecorded commit request is reused. A failed step, or
      // a recorded commit, needs an adopt request of its own, or the old answer
      // would be replayed.
      return state.createCommits
        ? commitForStep(
            root,
            dir,
            state,
            step,
            scope,
            step.status === 'failed' ||
              coveringLandedEntries(state, step.id).length > 0
              ? 'adopt'
              : undefined
          )
        : {
            entry: null,
            installFailed: await installFailedForStep(
              root,
              dir,
              state,
              step,
              'action-install',
              scope
            ),
          };
    case 'unresolved':
      // A reset restored the tree the step was dispensed against, so nothing
      // is left to install or to record as debt.
      if (resetTree) return { entry: null, installFailed: false };
      // A run that commits settles the step in giveUpStepTree instead.
      return retainedTreeSideEffects(
        root,
        dir,
        state,
        step,
        'action-install',
        scope
      );
    case 'skip':
      return retainedTreeSideEffects(
        root,
        dir,
        state,
        step,
        'action-install',
        scope
      );
    case 'retry':
    case 'retry-clean':
      return { entry: null, installFailed: false };
    default: {
      const exhaustive: never = action;
      throw new Error(`Unhandled step action '${exhaustive}'.`);
    }
  }
}

// Commits the working tree left by a folded prompt outcome or an adopted step
// (failed or died). The caller persists `entry` with the step transition
// unless `recorded` says a session's parent already did; null when nothing to
// commit. A crash between the git commit and the state write leaves that
// commit in history and out of the ledger, with the failures it absorbed
// uncovered; completion rechecks the tree before warning about that debt.
async function commitForStep(
  root: string,
  dir: string,
  state: MigrateRunState,
  step: MigrateStep,
  scope: TreeScope,
  commitAs?: 'adopt'
): Promise<StepSideEffects> {
  const { name } = splitMigrationId(step.migrationId);
  const absorbedStepIds = uncoveredFailedStepIds(state).filter(
    (id) => id !== step.id
  );
  const skipInstall = state.skipInstall === true;
  let commit: BrokeredCommit;
  try {
    commit = await commitStepTree(
      dir,
      step,
      absorbedStepIds,
      () =>
        commitMigrationIfRequested(
          root,
          { name },
          true,
          state.commitPrefix,
          () =>
            installDepsChangedSinceDispense(
              root,
              dir,
              step,
              skipInstall,
              reconcileCommand(root, state.runId)
            ),
          stepsToPendingMigrations(state, absorbedStepIds)
        ),
      scope,
      commitAs
    );
  } catch (e) {
    // Nothing to record: the step moved on, another process holds the tree, or
    // the parent never answered. The next reconcile redoes this fold or adopt.
    if (
      e instanceof BrokerStaleRequestError ||
      e instanceof BrokerUnavailableError ||
      e instanceof TreeBusyError
    ) {
      throw e;
    }
    // The dependency install is the only other thrower: the commit attempt
    // reports through result.status. The debt cannot stand in for the install
    // failure, since a later commit absorbing this diff clears the debt while
    // the dependencies are still missing.
    warnCommitFailed(name, e);
    return {
      entry: { kind: 'failed', stepIds: [step.id] },
      installFailed: true,
    };
  }
  if (commit.result.status === 'failed') {
    warnCommitFailed(name);
  }
  return {
    entry: commitResultToLedgerEntry(
      commit.result,
      step.id,
      commit.absorbedStepIds
    ),
    installFailed: false,
    recorded: commit.recorded,
  };
}

function advanceAndDispense(root: string, dir: string, runId: string): void {
  // Demote recorded issues no remaining step can claim before anything is
  // rendered. Done here, at the single choke point every dispense, retry
  // prompt, and completion goes through, on a fresh locked read: a step
  // turned terminal by a concurrent reconcile or worker since the caller's
  // read must not leave an unclaimable issue labeled recorded in a digest
  // or the completion report.
  const state = updateRunState(dir, (fresh) => {
    const settled = settleUnclaimableIssues(fresh);
    return settled === fresh ? null : settled;
  });
  const step = firstActionableStep(state);
  if (!step) {
    completeRun(root, dir, runId, state);
    return;
  }
  // Track the response streak before emitting: a crash in between costs at
  // most a count one ahead of what was emitted, and the escalation is
  // advisory. Only the step responses below count: the completion response
  // above repeats by design, and a rejected --step-action ends the reconcile
  // before reaching here, already naming its own fix.
  const noProgress = trackNoProgress(dir, step);
  // Another live process holds the tree: the responses below would offer
  // actions it refuses or name a pid already gone. A running step's own
  // operation with a live worker keeps still-running, which offers none.
  const held = liveTreeOperation(state);
  if (held && !isOwnOperation(step, held)) {
    emitHeld(root, runId, state, step, held, noProgress);
    return;
  }
  switch (step.status) {
    case 'pending':
      dispenseNextStep(root, dir, runId, state, step, noProgress);
      break;
    case 'dispensed':
      // Re-entry before the worker advanced the step; re-emit its command.
      emitNextStep(root, runId, state, step, noProgress);
      break;
    case 'failed':
      emitRetryFailed(root, runId, state, step, noProgress);
      break;
    case 'died':
      emitDied(root, runId, state, step, noProgress);
      break;
    case 'running':
      emitStillRunning(root, runId, state, step, held, noProgress);
      break;
    case 'awaiting-prompt-outcome':
      emitAwaitPrompt(root, dir, runId, step, noProgress);
      break;
    case 'succeeded':
    case 'skipped':
    case 'unresolved':
      // firstActionableStep already excludes these via TERMINAL_STEP_STATUSES;
      // landing here means an already-terminal step slipped through
      // unclassified rather than being left to stall the run silently.
      throw new Error(
        `Orchestrator could not dispense step '${step.id}': step is already ${step.status}.`
      );
    default: {
      // A new MigrateStepStatus member with no case above fails typecheck
      // here until it is classified.
      const exhaustive: never = step.status;
      throw new Error(
        `Orchestrator could not dispense step '${step.id}': unrecognized status '${exhaustive}'.`
      );
    }
  }
}

function isOwnOperation(
  step: MigrateStep,
  held: MigrateTreeOperation
): boolean {
  return (
    step.status === 'running' &&
    held.stepId === step.id &&
    step.pid !== undefined &&
    isPidAlive(step.pid)
  );
}

function firstActionableStep(state: MigrateRunState): MigrateStep | undefined {
  return state.steps.find((s) => !TERMINAL_STEP_STATUSES.has(s.status));
}

// The fingerprint digests the whole persisted state (minus the streak itself),
// so any durable change resets the count with no per-field enumeration to fall
// out of date. A response whose own production writes state after the streak
// is tracked fingerprints the pre-write state, so its first repeat resets
// rather than increments.
function responseFingerprint(state: MigrateRunState): string {
  return createHash('sha256')
    .update(JSON.stringify({ ...state, noProgress: undefined }))
    .digest('hex');
}

// A young, parseably-started worker neither increments nor resets the
// actionable-response streak. Unproven age counts normally.
function trackNoProgress(
  dir: string,
  step: MigrateStep
): MigrateRunNoProgress | null {
  if (step.status === 'running') {
    const startedAt = step.startedAt ? Date.parse(step.startedAt) : NaN;
    if (
      Number.isFinite(startedAt) &&
      Date.now() - startedAt < HANG_THRESHOLD_MS
    ) {
      return null;
    }
  }
  let streak: MigrateRunNoProgress;
  updateRunState(dir, (fresh) => {
    const fingerprint = responseFingerprint(fresh);
    const prev = fresh.noProgress;
    streak =
      prev && prev.fingerprint === fingerprint
        ? { ...prev, consecutiveCount: prev.consecutiveCount + 1 }
        : {
            fingerprint,
            consecutiveCount: 1,
            firstSeenAt: new Date().toISOString(),
          };
    return { ...fresh, noProgress: streak };
  });
  return streak.consecutiveCount >= NO_PROGRESS_THRESHOLD ? streak : null;
}

function dispenseNextStep(
  root: string,
  dir: string,
  runId: string,
  state: MigrateRunState,
  step: MigrateStep,
  noProgress: MigrateRunNoProgress | null
): void {
  // Read the pre-migration baselines (git and package.json reads) before the
  // lock; the dispense transition and the baselines then apply to the fresh
  // state in one write.
  const baselines: DispenseBaselines = {
    gitRefBefore: getLatestCommitSha(root) ?? undefined,
    treeCleanAtDispense: getWorkingTreeStatus(root) === 'clean',
    depsHashAtDispense: depsHash(root),
  };
  let advancedElsewhere = false;
  let held: MigrateTreeOperation | undefined;
  const current = updateRunState(dir, (fresh) => {
    // A concurrent init or reconcile may have dispensed (or further advanced)
    // this step since the caller's read; reclassify against the fresh state
    // below instead of failing the duplicate transition.
    if (fresh.steps.find((s) => s.id === step.id)?.status !== 'pending') {
      advancedElsewhere = true;
      return null;
    }
    // A checkpoint in flight would capture the dispensed step's changes;
    // checked in the write that dispenses, since it can start after any
    // earlier read.
    held = liveTreeOperation(fresh);
    if (held) return null;
    const dispensed = applyEventOrThrow(fresh, {
      type: 'dispense',
      stepId: step.id,
    });
    return setDispenseBaselines(dispensed, step.id, baselines);
  });
  if (advancedElsewhere) {
    // Terminates: step statuses only advance, so each re-entry observes
    // strictly later state and lands in a non-pending branch of the dispatch.
    advanceAndDispense(root, dir, runId);
    return;
  }
  if (held) {
    emitHeld(root, runId, current, step, held, noProgress);
    return;
  }
  const dispensed = current.steps.find((s) => s.id === step.id);
  reportMigrateOrchestratorStepDispensed({
    attempt: dispensed.attempt,
    ordinal: runTallies(current).dispenseCount,
  });
  emitNextStep(root, runId, current, dispensed, noProgress);
}

function emitNextStep(
  root: string,
  runId: string,
  state: MigrateRunState,
  step: MigrateStep,
  noProgress: MigrateRunNoProgress | null
): void {
  const migrationId = step.migrationId;
  emit(
    root,
    runId,
    state,
    step,
    'next-step',
    {
      command: workerCommand(root, migrationId, runId),
      next: reconcileCommand(root, runId),
      instructionLines: [
        `Apply migration ${migrationId} by running the command below, then run the "next" command to record the outcome and get the next step.`,
        ...renderIssueDigestLines(state, step.id, runId),
      ],
    },
    noProgress
  );
}

function emitRetryFailed(
  root: string,
  runId: string,
  state: MigrateRunState,
  step: MigrateStep,
  noProgress: MigrateRunNoProgress | null
): void {
  const migrationId = step.migrationId;
  // A worker failure records its summary on the outcome; a prompt the agent
  // reported as failed carries the agent's own reason on the prompt outcome.
  const summary = step.outcome?.summary ?? step.promptOutcome?.summary;
  const head = getLatestCommitSha(root);
  const tree = dirtyTreeSummary(root);
  const cleanRetry = canOfferCleanRetry(root, state, step, head);
  const landed = lastCoveringLandedEntry(state, step);
  const committed = commitMayBeInHistory(state, step);
  // A failure recorded before the generator marker can still have written to
  // the tree (a direct fs or exec side effect, or a crash mid-flush); a
  // marker means only the handed-back half (a prompt or a validation pass)
  // or the install and commit are left, so plain retry is safe outright. So
  // is retrying a step with no generator half to rerun.
  const pending = generatorPending(step);
  const retrySafety: PreMarkerRetrySafety = pending
    ? assessPreMarkerRetry(root, step)
    : { kind: 'safe' };
  const capReached = rearmCapReached(step);
  const lines = [
    `Migration ${migrationId} failed${summary ? `: ${summary}` : ''}.`,
    `  started from: ${step.gitRefBefore ?? '(unknown)'}`,
    `  current HEAD: ${head ?? '(unknown)'}`,
    `  working tree: ${tree === null ? '(unknown)' : tree ? `\n${tree}` : '(clean)'}`,
    ``,
    retryBudgetLine(step, committed),
    ``,
    `Decide how to proceed and re-run reconcile with one of:`,
    ...(capReached
      ? []
      : [retryOptionLine(retrySafety, reconcileCommand(root, runId, 'retry'))]),
  ];
  if (cleanRetry && !capReached) {
    lines.push(
      `  retry-clean: reset the tree to ${
        step.gitRefBefore ?? 'the pre-migration ref'
      } (discarding its uncommitted tracked changes and the untracked files git does not ignore, ${MIGRATE_RUNS_RELATIVE_DIR} kept) and retry from that clean state by running: ${reconcileCommand(
        root,
        runId,
        'retry-clean'
      )}`
    );
  }
  lines.push(
    landed
      ? `  adopt: keep the landed commit${
          landed.sha ? ` ${landed.sha}` : ''
        } and the current working-tree state as the migration's result, then run: ${reconcileCommand(
          root,
          runId,
          'adopt'
        )}`
      : `  adopt: the migration was applied by hand; keep the current working-tree state as its result, then run: ${reconcileCommand(
          root,
          runId,
          'adopt'
        )}`
  );
  // Refused by the state machine: the migration is, or may be, committed.
  if (!committed) {
    lines.push(
      `  skip:  ${reconcileCommand(root, runId, 'skip')}`,
      unresolvedOptionLine(
        root,
        runId,
        state,
        step,
        unresolvedResetsTree(state, step, cleanRetry)
      )
    );
  }
  if (pending) {
    lines.push(UNVERIFIABLE_WRITES_LINE);
  }
  // No preselected retry while the generator may still run: git cannot vouch
  // for every write. Past the cap no retry is offered or accepted.
  emit(
    root,
    runId,
    state,
    step,
    'retry-failed',
    {
      ...(pending || capReached
        ? {}
        : { next: reconcileCommand(root, runId, 'retry') }),
      instructionLines: lines,
    },
    noProgress
  );
}

// Whether the step has used up its rearms: attempts beyond the first are all
// rearms, whichever retry action produced them.
function rearmCapReached(step: MigrateStep): boolean {
  return step.attempt - 1 >= REARM_ESCALATION_CAP;
}

function retryBudgetLine(step: MigrateStep, committed: boolean): string {
  if (rearmCapReached(step)) return rearmCapLine(step, committed);
  const left = REARM_ESCALATION_CAP - (step.attempt - 1);
  return `Retries left for this migration: ${left}. Diagnose the failure first and retry only with a plausible fix in hand; ${
    left === 1
      ? 'this is the last one, so ask the user before using it'
      : 'ask the user before using the last one'
  }. When no user can answer, ${
    committed ? 'adopt the commit' : 'give the step up with unresolved'
  } and continue.`;
}

// Opens a capped dispense and is the reason a retry past the cap is refused.
function rearmCapLine(step: MigrateStep, committed: boolean): string {
  return `This migration has already been retried ${
    step.attempt - 1
  } times without completing, and no further retry is accepted. Choose ${
    committed ? 'adopt' : 'adopt, skip or unresolved'
  }, or ask the user how to proceed.`;
}

// Whether the step's generator half may still have to run: it exists and no
// attempt has recorded running it. Only then can a retry apply a generator
// twice, so only then is a continuation withheld from `next`. A step with no
// generator (prompt-only) is retried by re-prompting the agent over the tree
// it already knows, which is the designed recovery; a step recorded before the
// kind was persisted counts as having one.
function generatorPending(step: MigrateStep): boolean {
  return step.generatorCompleted !== true && step.hasGenerator !== false;
}

// Absent generatorMadeChanges (a marker an older nx wrote) counts as applied,
// keeping that version's fold behavior.
function generatorChangesApplied(step: MigrateStep): boolean {
  return (
    step.generatorCompleted === true && step.generatorMadeChanges !== false
  );
}

// Appended to the failed and died dispenses of a step whose generator may rerun.
const UNVERIFIABLE_WRITES_LINE = `None of these can be verified against writes git does not see (ignored paths, files outside the repository); if this migration writes there, inspect that state before choosing.`;

function retryOptionLine(
  safety: PreMarkerRetrySafety,
  command: string
): string {
  switch (safety.kind) {
    case 'safe':
      return `  retry: re-run over the current tree: ${command}`;
    case 'warned':
      return `  retry: re-run over the current tree; without git nothing can verify what the failed attempt left, so inspect the tree first: ${command}`;
    case 'unsafe':
      return `  retry: re-run over the current tree; refused until the working tree is clean and HEAD is at the started-from ref: ${command}`;
    default: {
      const exhaustive: never = safety;
      return exhaustive;
    }
  }
}

// How a plain retry of a failed step whose generator marker is absent can be
// handled. 'safe': git sees nothing of the failed attempt (tree verifiably
// clean, HEAD still at the step's starting ref; a moved HEAD can hold the
// attempt's partial writes as a commit and leave the tree clean). Writes git
// cannot see (ignored files, changes outside the repository) are beyond every
// check here, the same boundary retry-clean's reset has. 'warned': outside a
// git repository not even that much can be checked, so the retry stays
// available as an explicit choice behind a warning instead of being refused
// forever. 'unsafe': refused; a failed repository probe proves nothing and
// also lands here.
type PreMarkerRetrySafety =
  | { kind: 'safe' }
  | { kind: 'warned'; warning: string }
  | { kind: 'unsafe'; reason: string };

function assessPreMarkerRetry(
  root: string,
  step: MigrateStep
): PreMarkerRetrySafety {
  const repo = getGitRepositoryStatus(root);
  if (repo === 'not-git') {
    return {
      kind: 'warned',
      warning: `The workspace is not a git repository, so nothing can verify whether the failed attempt left partial changes in the tree. The retry reruns the generator over whatever is there; confirm the tree yourself first.`,
    };
  }
  if (repo === 'unknown') {
    return {
      kind: 'unsafe',
      reason: `the git repository state could not be determined, so nothing can verify whether the failed attempt left changes in the tree.`,
    };
  }
  const head = getLatestCommitSha(root);
  if (!step.gitRefBefore || head !== step.gitRefBefore) {
    return {
      kind: 'unsafe',
      reason: `HEAD is at ${head ?? '(unreadable)'} rather than the ${
        step.gitRefBefore ?? '(unrecorded)'
      } this migration started from, so the failed attempt's changes may already be committed and rerunning the generator could apply them twice.`,
    };
  }
  if (getWorkingTreeStatus(root) !== 'clean') {
    return {
      kind: 'unsafe',
      reason: `the working tree is not verifiably clean, and the failed attempt may have written to it before failing; rerunning the generator over those changes could apply them twice.`,
    };
  }
  return { kind: 'safe' };
}

// Whichever attempt landed it, the commit is this migration's result.
function lastCoveringLandedEntry(
  state: MigrateRunState,
  step: MigrateStep
): MigrateCommitLedgerEntry | null {
  const entries = coveringLandedEntries(state, step.id);
  return entries.length > 0 ? entries[entries.length - 1] : null;
}

// The give-up option, worded for what happens to the tree: the reserved
// reset, a partial commit, or the tree left as it stands.
function unresolvedOptionLine(
  root: string,
  runId: string,
  state: MigrateRunState,
  step: MigrateStep,
  resetTree: boolean
): string {
  const command = reconcileCommand(root, runId, 'unresolved');
  const recorded = `The failure is recorded as a run issue and listed in the completion report.`;
  if (resetTree) {
    return `  unresolved: give up on this migration, resetting the tree to ${
      step.gitRefBefore ?? 'the pre-migration ref'
    } (discarding what the failed attempt left, ${MIGRATE_RUNS_RELATIVE_DIR} kept), then run: ${command}. ${recorded}`;
  }
  if (state.createCommits) {
    return `  unresolved: give up on this migration; its partial changes are committed under its name, marked unresolved, and the run moves on. Then run: ${command}. ${recorded}`;
  }
  return `  unresolved: give up on this migration, leaving the tree as it stands, and move on. Then run: ${command}. ${recorded}`;
}

function emitDied(
  root: string,
  runId: string,
  state: MigrateRunState,
  step: MigrateStep,
  noProgress: MigrateRunNoProgress | null
): void {
  const migrationId = step.migrationId;
  const ref = step.gitRefBefore;
  const head = getLatestCommitSha(root);
  const tree = dirtyTreeSummary(root);
  const cleanRetry = canOfferCleanRetry(root, state, step, head);
  const committed = commitMayBeInHistory(state, step);
  const resume = !generatorPending(step);
  const capReached = rearmCapReached(step);
  const lines = [
    `The worker for ${migrationId} died; its process is gone.`,
    `  started from: ${ref ?? '(unknown)'}`,
    `  current HEAD: ${head ?? '(unknown)'}`,
    `  working tree: ${tree === null ? '(unknown)' : tree ? `\n${tree}` : '(clean)'}`,
    ``,
    retryBudgetLine(step, committed),
    ``,
  ];
  const options: string[] = [];
  if (resume && !capReached) {
    options.push(
      `  retry: keep everything this migration already produced (its commit, if any, and the current tree) and run only the part that did not complete, then run: ${reconcileCommand(
        root,
        runId,
        'retry'
      )}`
    );
  }
  if (cleanRetry && !capReached) {
    options.push(
      `  retry-clean: reset the tree to ${
        ref ?? 'the pre-migration ref'
      } (discarding its uncommitted tracked changes and the untracked files git does not ignore, ${MIGRATE_RUNS_RELATIVE_DIR} kept) and retry from that clean state by running: ${reconcileCommand(
        root,
        runId,
        'retry-clean'
      )}`
    );
  } else if (!capReached) {
    lines.push(
      `A clean retry is unavailable: ${cleanRetryUnavailableReason(
        root,
        state,
        step,
        head
      )}`
    );
  }
  options.push(
    `  adopt: keep the current working-tree state as this migration's result, then run: ${reconcileCommand(
      root,
      runId,
      'adopt'
    )}`
  );
  // Refused by the state machine: the migration is, or may be, committed.
  if (!committed) {
    options.push(
      `  skip: leave the tree as it stands and move on without this migration, then run: ${reconcileCommand(
        root,
        runId,
        'skip'
      )}`,
      unresolvedOptionLine(
        root,
        runId,
        state,
        step,
        unresolvedResetsTree(state, step, cleanRetry)
      )
    );
  }
  lines.push(`Choose exactly one:`);
  lines.push(...options);
  if (!resume) {
    lines.push(UNVERIFIABLE_WRITES_LINE);
  }
  // `retry` is preselected only when no generator remains to run and the cap
  // allows it: a reset cannot be verified against writes git does not see, and
  // adopting records a result nothing checked, so neither is automatic.
  emit(
    root,
    runId,
    state,
    step,
    'died',
    {
      ...(resume && !capReached
        ? { next: reconcileCommand(root, runId, 'retry') }
        : {}),
      instructionLines: lines,
    },
    noProgress
  );
}

function emitHeld(
  root: string,
  runId: string,
  state: MigrateRunState,
  step: MigrateStep,
  held: MigrateTreeOperation,
  noProgress: MigrateRunNoProgress | null
): void {
  emit(
    root,
    runId,
    state,
    step,
    'held',
    {
      next: reconcileCommand(root, runId),
      instructionLines: [treeBusyMessage(held)],
    },
    noProgress
  );
}

function emitStillRunning(
  root: string,
  runId: string,
  state: MigrateRunState,
  step: MigrateStep,
  held: MigrateTreeOperation | undefined,
  noProgress: MigrateRunNoProgress | null
): void {
  const migrationId = step.migrationId;
  const ageMs = step.startedAt ? Date.now() - Date.parse(step.startedAt) : 0;
  const lines = [
    `The worker for ${migrationId} (pid ${step.pid}) is still running. Wait for it to finish, then run the "next" command.`,
  ];
  // A holder pid other than the worker's is the session's parent process.
  const parentOperation =
    held !== undefined && held.pid !== step.pid
      ? treeOperationLabel(held)
      : undefined;
  if (parentOperation) {
    lines.push(
      `The nx process ${held.pid} is running ${parentOperation} for it; killing the worker does not stop that, and the step can be classified as died only once it finishes.`
    );
  }
  if (ageMs >= HANG_THRESHOLD_MS) {
    const hung = `It has been running for ${Math.floor(
      ageMs / 60000
    )} minutes and may be hung.`;
    lines.push(
      parentOperation
        ? `${hung} Report this to the user: they can quit this session, then press Ctrl+C in the terminal to end ${parentOperation}, and resume the run afterwards.`
        : `${hung} Verify pid ${step.pid}; either keep waiting, or kill it so the next reconcile can classify it as died.`
    );
  }
  emit(
    root,
    runId,
    state,
    step,
    'still-running',
    {
      next: reconcileCommand(root, runId),
      instructionLines: lines,
    },
    noProgress
  );
}

function emitAwaitPrompt(
  root: string,
  dir: string,
  runId: string,
  step: MigrateStep,
  noProgress: MigrateRunNoProgress | null
): void {
  const migrationId = step.migrationId;
  const filePath = runStepHandoffPath(dir, step.id);
  // Recreated if the agent removed it, so the handed-over path always has its
  // parent (an agent that has to `mkdir -p` pays a permission prompt).
  const handoffsDir = runHandoffsDir(dir);
  const handoffsDirIs = handoffsDirState(handoffsDir);
  if (handoffsDirIs === 'missing') {
    mkdirSync(handoffsDir, { recursive: true });
  }
  // Claim only while fresh state still awaits this handoff. Steps that never
  // park cannot report updates; serial dispensing fixes order, and stale
  // attempts redispatch.
  let advancedElsewhere = false;
  const claimed = updateRunState(dir, (fresh) => {
    const freshStep = fresh.steps.find((s) => s.id === step.id);
    if (
      freshStep?.status !== 'awaiting-prompt-outcome' ||
      freshStep.attempt !== step.attempt
    ) {
      advancedElsewhere = true;
      return null;
    }
    const next = claimIssuesForStep(fresh, step.id, runId);
    return next === fresh ? null : next;
  });
  if (advancedElsewhere) {
    // Terminates like dispenseNextStep's redispatch: step state only
    // advances, so each re-entry observes strictly later state.
    advanceAndDispense(root, dir, runId);
    return;
  }
  const validating = step.awaitingKind === 'generator-validation';
  // The plan's prompt path is the ground truth for a prompt park: a stored copy
  // naming different instructions is rejected against it.
  const planPrompt = validating
    ? null
    : planPromptPath(dir, claimed, migrationId);
  // Re-emit the payload the worker stored when it parked the step, so a
  // session that lost the original block gets the work restated. An awaiting
  // step offers no retry action, so a dispense that only pointed backward
  // could stall a valid run forever; only a plan that cannot name the prompt
  // falls back to that pointer.
  const payload =
    readAgentWorkPayload(agentWorkPayloadPath(dir, step.id, step.attempt), {
      migrationId,
      kind: validating ? 'generator-validation' : 'migration-prompt',
      ...(planPrompt === null ? {} : { promptPath: planPrompt }),
    }) ??
    (validating
      ? { migrationId, kind: 'generator-validation' }
      : planPrompt === null
        ? null
        : { migrationId, prompt: planPrompt });
  if (payload) {
    emitPromptBlock(migrationId, payload);
  }
  const blockRef = payload
    ? 'the <nx_migrate_prompt> block above'
    : "the worker's earlier <nx_migrate_prompt> block";
  const lines = validating
    ? [
        `Migration ${migrationId} ran its generator; its changes are awaiting your validation.`,
        `Validate them (see ${blockRef} and the runbook's validation scope rules), then write the handoff file and run the "next" command.`,
      ]
    : [
        `Migration ${migrationId} is a prompt-based migration awaiting your outcome.`,
        `Apply the prompt (see ${blockRef}), then write the handoff file and run the "next" command.`,
        // Resolved per dispense: an earlier step may have changed the formatter
        // since the runbook was written.
        `Format command: ${
          resolveFormatCommand(root, pmExecPrefix(root)) ??
          'none (no configured formatter is installed)'
        }`,
      ];
  lines.push(
    `Handoff file: ${filePath}`,
    // The skipped outcome is offered only while nothing of the migration is in
    // the tree: once a generator's changes are applied, the fold treats a
    // skipped handoff as completed anyway.
    validating
      ? `Handoff JSON: ${renderHandoffShapeInline('what you verified')}. If validation does not apply here, use "status": "success" and say so in the summary.`
      : generatorChangesApplied(step)
        ? `Handoff JSON: ${renderHandoffShapeInline('what you did')}. If the prompt does not apply here, use "status": "success" and say so in the summary; the migration's generator changes are already applied.`
        : `Handoff JSON: ${renderHandoffShapeInline('what you did')}. To mark the prompt not applicable, use "status": "success" with "outcome": "skipped".`
  );
  lines.push(...renderIssueDigestLines(claimed, step.id, runId));
  // A handoff that exists but can't be read/parsed/validated is a rejection,
  // not a still-awaited outcome. Naming why stops the run from re-emitting the
  // same await forever while the agent leaves the bad file in place.
  // A non-directory in the handoffs dir's place is never read through, so a
  // rewritten handoff cannot cure it: name the replacement instead.
  const rejection =
    handoffsDirIs === 'other'
      ? [
          `${handoffsDir} is not a directory, so no handoff can be read from it. Replace it with a directory, then write the handoff file and run the "next" command.`,
        ]
      : describeRejectedHandoff(dir, claimed, step);
  if (rejection.length > 0) {
    lines.push('', ...rejection);
  }
  emit(
    root,
    runId,
    claimed,
    step,
    'await-prompt',
    {
      next: reconcileCommand(root, runId),
      instructionLines: lines,
    },
    noProgress
  );
}

// The prompt path the run's latest plan snapshot records for the migration.
// Every failure lands on null, damaged-but-parseable snapshots included: this
// runs while re-handing an awaiting step's work, and throwing here would keep
// the run from re-dispensing that work at all. The snapshot name is validated
// as a bare `plan-<round>.json` at state read, so the join cannot leave the run
// directory.
function planPromptPath(
  dir: string,
  state: MigrateRunState,
  migrationId: string
): string | null {
  const round = latestRound(state);
  if (!round) return null;
  let migrations: unknown;
  try {
    migrations = readJsonFile<{ migrations?: unknown }>(
      join(dir, round.planSnapshot)
    ).migrations;
  } catch {
    return null;
  }
  if (!Array.isArray(migrations)) return null;
  for (const entry of migrations) {
    if (typeof entry !== 'object' || entry === null) continue;
    const migration = entry as PlannedMigration;
    if (`${migration.package}:${migration.name}` !== migrationId) continue;
    return typeof migration.prompt === 'string' ? migration.prompt : null;
  }
  return null;
}

// Wording mirrors the classic runner's ambiguous-outcome cause lines. A
// readable handoff whose issue report is invalid is a rejection too: the fold
// refused to consume it, and only this response can tell the agent why.
function describeRejectedHandoff(
  dir: string,
  state: MigrateRunState,
  step: MigrateStep
): string[] {
  const result = readStepHandoff(dir, step.id);
  const followUp = 'Rewrite the handoff file, then run the "next" command.';
  if (result.ok === true) {
    const issues = parseHandoffIssues(result.handoff.extras, state, step);
    if (issues.ok !== true) {
      return [
        `The handoff file was rejected: ${
          (issues as { ok: false; reason: string }).reason
        }.`,
        followUp,
      ];
    }
    return [];
  }
  const { reason, detail } = result as {
    ok: false;
    reason: HandoffReadFailureReason;
    detail?: string;
  };
  if (reason === 'missing') return [];
  switch (reason) {
    case 'read-error':
      return [
        `The handoff file was rejected: it could not be read${
          detail ? ` (${detail})` : ''
        }.`,
        followUp,
      ];
    case 'parse-error':
      return [
        `The handoff file was rejected: it contained invalid JSON${
          detail ? ` (${detail})` : ''
        }.`,
        followUp,
      ];
    case 'shape-mismatch':
      return [
        'The handoff file was rejected: it was missing required fields or had an unexpected shape.',
        followUp,
      ];
    default: {
      const exhaustive: never = reason;
      throw new Error(`Unrecognized handoff rejection reason '${exhaustive}'.`);
    }
  }
}

// A refused --step-action still exits 0: the tagged error block is the answer
// to the request, and it carries the reconcile command to run next. A non-zero
// exit would tell the driving agent that reconcile itself crashed, and it
// would stop reading for the correction it is being handed.
function emitError(root: string, runId: string, reason: string): void {
  // A rejected action is an active response like any dispense, so it carries
  // the runbook footer: the master receiving it may have just lost its
  // context. One sanitized array feeds both outputs, as in emit().
  const lines = safeLines([reason, ...runbookFooterLines(root, runId)]);
  warnToAgent({
    title: 'The requested --step-action could not be applied.',
    bodyLines: lines,
  });
  emitStepBlock(runId, '-', 'error', {
    next: reconcileCommand(root, runId),
    instructions: lines.join('\n'),
  });
  reportMigrateOrchestratorDispense({ action: 'error', attempt: 0 });
}

/**
 * What a completed run leaves behind for whoever reads its summary, one line
 * group per warning: commit debt, uninstalled dependency changes, unresolved
 * issues. Empty when nothing is left.
 */
export function completionWarnings(
  root: string,
  runId: string,
  state: MigrateRunState
): string[][] {
  // The crash-refold window can strand a failed ledger entry whose diff was in
  // fact absorbed; suppress the warning only on a verified-clean tree. A dirty
  // tree can still be unrelated edits, so the warning only claims the changes
  // "may remain".
  const commitDebt =
    hasPendingCommitDebt(state) && getWorkingTreeStatus(root) !== 'clean';
  const uninstalled = state.steps.filter((s) => s.installFailed);
  const issueLines = renderUnresolvedIssueLines(state, runId);
  return [
    ...(commitDebt
      ? [
          [
            'Some migration changes could not be committed and may remain in the working tree; review and commit them manually.',
          ],
        ]
      : []),
    ...(uninstalled.length > 0
      ? [
          [
            `The dependency changes made by ${uninstalled
              .map((s) => s.migrationId)
              .join(', ')} were not installed; run \`${pmInstallCommand(
              root
            )}\` before using the workspace.`,
          ],
        ]
      : []),
    ...(issueLines.length > 0 ? [issueLines] : []),
  ];
}

function completeRun(
  root: string,
  dir: string,
  runId: string,
  state: MigrateRunState
): void {
  let current = state;

  // Persist the terminal status and claim the watermark in one fresh-state
  // write before emitting: a crash between the write and the output can't
  // double-count the completion, and of two concurrent reconciles exactly one
  // claims the report.
  let shouldEmit = false;
  if (current.status !== 'completed' || !current.analytics.completeEmitted) {
    current = updateRunState(dir, (fresh) => {
      if (fresh.status === 'completed' && fresh.analytics.completeEmitted) {
        return null;
      }
      shouldEmit = !fresh.analytics.completeEmitted;
      return {
        ...fresh,
        status: 'completed',
        analytics: { ...fresh.analytics, completeEmitted: true },
      };
    });
  }
  if (shouldEmit) {
    reportMigrateOrchestratorComplete(runTallies(current));
  }

  const warnings = completionWarnings(root, runId, current);
  for (const lines of warnings) {
    warnToAgent({ title: lines[0], bodyLines: lines.slice(1) });
  }
  const instructionLines = [
    `Migrate run ${runId} is complete.`,
    ...completionSummaryLines(current),
    ...warnings.flat(),
  ];
  logToAgent({ title: 'nx migrate: complete', bodyLines: instructionLines });
  emitStepBlock(runId, '-', 'complete', {
    instructions: instructionLines.join('\n'),
  });
}

interface DispensePayload {
  command?: string;
  next?: string;
  // Unjoined on purpose: joining and splitting back would turn a break inside
  // a value into its own line before anything could tell it from an authored
  // one. Joined only when the payload is serialized,
  // so the block's `instructions` string stays what it has always been.
  instructionLines?: string[];
}

function emit(
  root: string,
  runId: string,
  state: MigrateRunState,
  step: MigrateStep,
  action: string,
  payload: DispensePayload,
  noProgress: MigrateRunNoProgress | null
): void {
  // At the escalation threshold the whole response becomes the 'no-progress'
  // action, with the step's own instructions kept below so acting on them stays
  // possible. Never a step status: nothing durable changed, and a status would
  // have to be walked back once the agent acts.
  const escalated = noProgress !== null;
  const effectiveAction = escalated ? 'no-progress' : action;
  const { instructionLines, ...rest } = payload;
  const allLines = escalated
    ? [...noProgressLines(step, noProgress), ...(instructionLines ?? [])]
    : instructionLines;
  const withFooter = allLines
    ? [...allLines, ...runbookFooterLines(root, runId)]
    : undefined;
  // One sanitized array feeds both, so the block payload says exactly what the
  // human echo said.
  const lines = withFooter ? safeLines(withFooter) : undefined;
  logToAgent({ title: `nx migrate: ${effectiveAction}`, bodyLines: lines });
  emitStepBlock(runId, step.id, effectiveAction, {
    ...rest,
    ...(lines ? { instructions: lines.join('\n') } : {}),
  });
  reportMigrateOrchestratorDispense({
    action: effectiveAction,
    attempt: step.attempt,
    ordinal: runTallies(state).dispenseCount,
  });
}

function noProgressLines(
  step: MigrateStep,
  streak: MigrateRunNoProgress
): string[] {
  return [
    `No progress: this is response ${streak.consecutiveCount} in a row for migration ${step.migrationId} with no change in the run's recorded state since ${streak.firstSeenAt}.`,
    `Re-running the reconcile command changes nothing on its own; act on the instructions below. If something is blocking you from acting on them, stop looping and report the blocker to the user.`,
    ``,
  ];
}

// Append the runbook path to init, active and rejected responses so a
// compacted, truncated or restarted session can recover the contract. Missing
// or non-regular runbooks stand alone.
function runbookFooterLines(root: string, runId: string): string[] {
  if (
    lstatRunbook(join(runDir(root, runId), RUNBOOK_FILE_NAME))?.isFile() !==
    true
  ) {
    return [];
  }
  return [
    ``,
    `Runbook: ${MIGRATE_RUNS_RELATIVE_DIR}/${runId}/${RUNBOOK_FILE_NAME}. After a compaction or restart, re-read it and run \`${reconcileCommand(
      root,
      runId
    )}\`; never infer the run's progress from memory.`,
  ];
}

// Raw argv is forwarded verbatim across the wrapper hops, so every flag is a
// single `--flag=value` token. Interpolated values are validated shell-safe at
// init (migration ids; resumed run ids are gated by the run-dir scan) and
// reconcile entry (run id).
function workerCommand(
  root: string,
  migrationId: string,
  runId: string
): string {
  return `${pmExecPrefix(
    root
  )} nx migrate --run-migration=${migrationId} --run-id=${runId}`;
}

function reconcileCommand(
  root: string,
  runId: string,
  action?: StepAction
): string {
  const base = `${pmExecPrefix(root)} nx migrate --run-id=${runId}`;
  return action ? `${base} --step-action=${action}` : base;
}

interface DispenseBaselines {
  // Undefined when there is no HEAD to capture. This and treeCleanAtDispense
  // replace what the step held, so an absent value clears rather than
  // inherits; depsHashAtDispense is kept once set (see setDispenseBaselines).
  gitRefBefore: string | undefined;
  treeCleanAtDispense: boolean;
  // Null when the probe failed. Recording nothing leaves the step with no
  // baseline, which a later comparison reads as unknown and installs on;
  // recording a stand-in hash would let it read as "unchanged" instead.
  depsHashAtDispense: string | null;
}

// Records what the workspace looked like as this attempt starts. The git ref
// and the tree state are re-captured per dispense, since a retry restarts from
// wherever the tree is now. The dependency baseline is not: it tracks the last
// dependencies that were actually installed, moving only when an install
// lands, so a retry that only has the commit left to do still sees the
// previous attempt's package.json edits as needing one.
function setDispenseBaselines(
  state: MigrateRunState,
  stepId: string,
  baselines: DispenseBaselines
): MigrateRunState {
  const depsBaseline = state.steps.find(
    (s) => s.id === stepId
  )?.depsHashAtDispense;
  return {
    ...state,
    steps: state.steps.map((s) =>
      s.id === stepId
        ? {
            ...s,
            gitRefBefore: baselines.gitRefBefore,
            treeCleanAtDispense: baselines.treeCleanAtDispense,
            depsHashAtDispense:
              depsBaseline ?? baselines.depsHashAtDispense ?? undefined,
          }
        : s
    ),
  };
}

// Applies a step event to fresh state or throws the orchestrator's advance
// error. Pure; callers persist the result via updateRunState.
function applyEventOrThrow(
  state: MigrateRunState,
  event: StepEvent
): MigrateRunState {
  const result = applyStepEvent(state, event);
  if (result.kind === 'error') {
    throw new Error(`Orchestrator could not advance the run: ${result.reason}`);
  }
  return result.state;
}

function readStepHandoff(dir: string, stepId: string): HandoffReadResult {
  return readHandoffWithReason(
    runStepHandoffPath(dir, stepId),
    runHandoffsDir(dir)
  );
}

// Probe-time guard: a handoffs dir the agent swapped for a symlink into a
// directory holding a file of the step's fixed name would otherwise have the
// orchestrator delete that file. A swap between the probe and the rm is not
// caught. A probe failure skips the rm too; the next read reports it.
function removeHandoff(dir: string, stepId: string): void {
  let state: ReturnType<typeof handoffsDirState>;
  try {
    state = handoffsDirState(runHandoffsDir(dir));
  } catch {
    return;
  }
  if (state === 'directory') {
    rmSync(runStepHandoffPath(dir, stepId), { force: true });
  }
}

// null means the probe itself failed; the death dispense renders that as
// '(unknown)', because '(clean)' would invite a retry-clean reset over
// evidence that was never gathered (getWorkingTreeStatus's contract).
function dirtyTreeSummary(root: string): string | null {
  try {
    return execSync('git status --porcelain', {
      encoding: 'utf8',
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    }).trim();
  } catch {
    return null;
  }
}
