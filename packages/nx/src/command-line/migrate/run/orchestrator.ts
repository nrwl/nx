import { execSync } from 'child_process';
import { randomBytes } from 'crypto';
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
  type BigIntStats,
} from 'fs';
import { dirname, join } from 'path';
import { readJsonFile, writeJsonFile } from '../../../utils/fileutils';
import {
  getGitRepositoryStatus,
  getLatestCommitSha,
  getPathCommitExposure,
  getWorkingTreeStatus,
  isAncestorCommit,
  type PathCommitExposure,
} from '../../../utils/git-utils';
import { nxVersion } from '../../../utils/versions';
import {
  stepHandoffPath,
  readHandoffWithReason,
  type HandoffReadFailureReason,
} from '../agentic/handoff';
import { applyAgenticHandoffGitignoreFallback } from '../agentic/handoff-gitignore';
import { MIGRATE_RUNS_RELATIVE_DIR, type HandoffFile } from '../agentic/types';
import {
  commitCheckpointBeforeMigrations,
  commitMigrationIfRequested,
} from '../migrate-commits';
import {
  reportMigrateOrchestratorComplete,
  reportMigrateOrchestratorDispense,
  reportMigrateOrchestratorInit,
} from '../migrate-analytics';
import { sortMigrations } from '../sort-migrations';
import { createRunId, computePlanHash, RUN_ID_SAFE } from './run-id';
import {
  createRun,
  findActiveRun,
  hasRunState,
  readRunState,
  runDir,
  CURRENT_RUN_STATE_FORMAT_VERSION,
  SHELL_SAFE_VALUE,
  type MigrateCommitLedgerEntry,
  type MigrateRunState,
  type MigrateStep,
  type MigrateStepPromptOutcome,
  type MigrateStepStatus,
} from './run-state';
import { updateRunState, withRunCreationLock } from './state-lock';
import {
  applyStepEvent,
  commitResultToLedgerEntry,
  coveringLandedEntries,
  hasPendingCommitDebt,
  latestRound,
  markInstallFailed,
  splitMigrationId,
  stepsToPendingMigrations,
  uncoveredFailedStepIds,
  type StepAction,
  type StepEvent,
} from './state-machine';
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
  renderRunbook,
  RUNBOOK_FILE_NAME,
  type RunbookContext,
} from './runbook';
import { detectPackageManager } from '../../../utils/package-manager';

// The dark migrate orchestrator: drives a durable run one dispense at a time.
// An outer AI agent runs each dispensed command and re-invokes `nx migrate
// --run-id=<id>` to reconcile; there is no long-lived process.

const PLAN_SNAPSHOT_0 = 'plan-0.json';
// A running worker older than this may be hung; the still-running dispense
// escalates so the agent can verify or kill it.
const HANG_THRESHOLD_MS = 15 * 60 * 1000;

// Steps in these statuses are done; every other status needs a dispense.
const TERMINAL_STATUSES = new Set<MigrateStepStatus>(['succeeded', 'skipped']);

export interface RunOrchestratorInitInput {
  root: string;
  // The full parsed migrations.json, snapshotted verbatim as plan-0.json.
  migrationsJson: { migrations?: PlannedMigration[]; [k: string]: unknown };
  createCommits: boolean;
  commitPrefix: string;
  // The run's install policy. Dispensed commands carry no flags of the user's,
  // so the run has to record it here for the installs the loop itself runs.
  skipInstall: boolean;
  // Workspace-local nx version; the v23 cutoff for the .gitignore fallback.
  installedNxVersion: string;
  // The `--validate` flag as the user passed it (undefined when omitted); the
  // run records the resolved policy the same way it records skipInstall.
  validate: boolean | undefined;
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
): Promise<void> {
  const {
    root,
    migrationsJson,
    createCommits,
    commitPrefix,
    skipInstall,
    installedNxVersion,
    validate,
  } = input;
  const planHash = computePlanHash(migrationsJson);

  // An active run means a prior init already happened (e.g. it crashed before
  // the agent's first reconcile); starting a second run would compete with it.
  // Same plan: resume it. Different plan: refuse rather than guess which plan
  // the agent means. NewerRunStateFormatError propagates.
  const active = findActiveRunForPlan(root, planHash);

  // Dispensed commands interpolate migration ids verbatim, so every init
  // (fresh or resumed) validates the incoming plan's ids. After the mismatch
  // check: a plan that will be refused anyway should get the more actionable
  // mismatch error, not this one.
  const migrations = (migrationsJson.migrations ?? []) as PlannedMigration[];
  const sorted = sortMigrations(migrations.slice(), {
    hoistHandoffGitignore: true,
  });
  for (const m of sorted) {
    const id = `${m.package}:${m.name}`;
    if (!SHELL_SAFE_VALUE.test(id)) {
      throw new Error(
        `The migration id '${id}' contains characters that are not shell-safe. Orchestrated runs require shell-safe migration ids.`
      );
    }
  }

  if (active) {
    resumeRun(root, active.runId, active.state);
    return;
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
  // Checkpoint pre-existing working-tree state BEFORE the run dir exists, so
  // the checkpoint's `git add -A` can't track this run's scratch and a clean
  // tree stays uncommitted (writing run.json would otherwise dirty it and fire
  // a spurious checkpoint). A crash between here and createRun leaves the
  // committed changes orphaned but never lost; the next init re-checkpoints a
  // now-clean tree as a no-op.
  const checkpoint = createCommits ? checkpointEntry(root, commitPrefix) : null;
  // The preflight checkpoint swallows its own failures, so the tree itself is
  // the only reliable signal: anything still uncommitted here predates every
  // step's gitRefBefore and rules out clean retries for the whole run. A
  // failed probe counts as dirty: mistaking it for clean would let a later
  // retry-clean reset destroy the very work this flag exists to protect.
  const checkpointFailed =
    createCommits && getWorkingTreeStatus(root) !== 'clean';
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
    rounds: [
      {
        index: 0,
        planHash,
        planSnapshot: PLAN_SNAPSHOT_0,
      },
    ],
    steps: buildSteps(sorted),
    commits: checkpoint ? [checkpoint] : [],
    ...(checkpointFailed ? { checkpointFailed: true } : {}),
    analytics: { startEmitted: false, completeEmitted: false },
  };
  // The check/create boundary runs under the creation lock: without it, two
  // concurrent inits could both observe no active run above and create
  // competing runs against the same workspace. The git side effects above
  // stay outside the lock (locked sections must remain synchronous); a losing
  // init's checkpoint commit is the same orphan shape as the crash window
  // above, and the fallback's .gitignore edit is idempotent.
  const winner = withRunCreationLock(root, () => {
    const nowActive = findActiveRunForPlan(root, planHash);
    if (nowActive) {
      return nowActive;
    }
    // The snapshot must exist before run.json makes the run discoverable: a
    // crash in between must not leave an active run without its plan.
    mkdirSync(dir, { recursive: true });
    writeJsonFile(join(dir, PLAN_SNAPSHOT_0), migrationsJson);
    // The runbook gets the same crash guarantee: a discoverable run always
    // has the runbook a resume re-emits from disk. 'wx' creates without
    // following links, so nothing pre-planted at the path can redirect it.
    writeFileSync(
      join(dir, RUNBOOK_FILE_NAME),
      renderRunbook(runbookContext(root, runId, state)),
      { flag: 'wx' }
    );
    createRun(root, state);
    return null;
  });
  if (winner) {
    resumeRun(root, winner.runId, winner.state);
    return;
  }

  finishInit(root, dir, runId, state, 'created');
}

// Reads the newest active run, refusing one whose plan differs from the
// incoming plan; null when no run is active. Uninterpretable run dirs refuse
// a fresh start (one of them could be an active run this init would compete
// with) but only warn when a healthy active run is being resumed.
// NewerRunStateFormatError propagates from the read.
function findActiveRunForPlan(
  root: string,
  planHash: string
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
    if (!active) {
      throw new Error(
        [
          `Whether a migrate run is still active could not be determined; starting a new run could re-apply migrations an unfinished run already applied.`,
          ...details,
          `Fix or remove the listed ${noun} (removing a run directory abandons that run; migrations it already applied remain applied), then re-run the command.`,
        ].join('\n')
      );
    }
    warnToAgent({
      title: `Ignoring ${uninterpretable.length} migrate run ${noun} that could not be read.`,
      bodyLines: details,
    });
  }
  if (active && latestRound(active.state)?.planHash !== planHash) {
    throw new Error(
      `A migrate run '${active.runId}' is already active with a different plan. ` +
        `Finish it first by running \`${reconcileCommand(root, active.runId)}\`, ` +
        `or remove ${MIGRATE_RUNS_RELATIVE_DIR}/${active.runId} to abandon it.`
    );
  }
  return active;
}

// Shared resume tail for an active run found before or under the creation
// lock, so the two discovery points cannot drift apart.
function resumeRun(root: string, runId: string, state: MigrateRunState): void {
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
    return;
  }
  // A run flagged checkpointFailed gets one more chance to capture the
  // pre-existing tree state before its first migration commit absorbs it.
  const resumed = ensureCheckpoint(root, dir, state);
  announceResume(runId, resumed);
  finishInit(root, dir, runId, resumed, 'resumed', runbook);
}

// The initialized response that follows says nothing about the steps already
// behind it, so a resumed run is otherwise indistinguishable from a fresh one
// that happens to start partway down the plan.
function announceResume(runId: string, state: MigrateRunState): void {
  const applied = state.steps.filter((s) => s.status === 'succeeded').length;
  const skipped = state.steps.filter((s) => s.status === 'skipped').length;
  const remaining = state.steps.length - applied - skipped;
  // A subset of `remaining`, called out separately: a run is resumed most often
  // because one of these is waiting on a decision, and the count alone would
  // read as work that has not been reached yet.
  const stalled = state.steps.filter(
    (s) => s.status === 'failed' || s.status === 'died'
  ).length;
  logToAgent({
    title: `nx migrate: resuming run ${runId}`,
    bodyLines: [
      `  started: ${state.createdAt}`,
      `  progress: ${applied} applied, ${skipped} skipped, ${remaining} remaining${
        stalled > 0 ? ` (${stalled} awaiting a decision)` : ''
      }`,
    ],
  });
}

// Resume-only checkpoint retry, gated on checkpointFailed: a fresh init always
// evaluates the checkpoint before the run dir exists, so an unflagged run
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
  // The checkpoint commit is a git side effect, so it runs before the lock; the
  // ledger append and flag clear then apply to the fresh on-disk state.
  const checkpoint = checkpointEntry(root, state.commitPrefix);
  // The retried checkpoint captured everything, so clean retries are safe
  // again. Only a verified-clean tree clears the flag: a failed probe proves
  // nothing was captured.
  const cleared = getWorkingTreeStatus(root) === 'clean';
  if (!checkpoint && !cleared) return state;
  return updateRunState(dir, (fresh) => {
    // Re-check both guards on the fresh state: a concurrent reconcile may have
    // cleared the flag or advanced a step while the commit ran. Skipping here
    // can leave that commit unledgered, the documented crash-window shape.
    if (
      !fresh.checkpointFailed ||
      fresh.steps.some((s) => s.status !== 'pending')
    ) {
      return null;
    }
    const next = checkpoint ? appendCommit(fresh, checkpoint) : fresh;
    return cleared ? { ...next, checkpointFailed: false } : next;
  });
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

// Shared tail of a fresh and a resumed init: emit the init analytics once per
// run (watermark-guarded), then a runbook-only response. No migration step is
// dispensed here: the agent reads the runbook first and asks for the run's
// current step by reconciling, so the contract always lands before the first
// command does.
function finishInit(
  root: string,
  dir: string,
  runId: string,
  state: MigrateRunState,
  origin: 'created' | 'resumed',
  // The runbook bytes when the caller already ensured them (the resume path,
  // which must fail before its git and state side effects).
  runbook?: string
): void {
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
  const content = runbook ?? ensureRunbook(root, dir, runId, current);
  if (content === null) {
    return;
  }
  emitRunbookBlock(runId, content);
  const instructionLines = [
    `Nx ${origin} migrate run ${runId}. No migration step ran in this response.`,
    `Read the runbook above; it is the contract for driving this run. Then run the "next" command to get the run's current step.`,
  ];
  const lines = safeLines(instructionLines);
  logToAgent({ title: `nx migrate: run ${origin}`, bodyLines: lines });
  emitStepBlock(runId, '-', 'initialized', {
    next: reconcileCommand(root, runId),
    instructions: lines.join('\n'),
  });
}

// Ensures the run's runbook is present and readable, returning its bytes. A
// missing file is re-rendered only by the nx version that created the run:
// the runbook's content is version-locked, and a different nx re-rendering it
// would silently hand the agent a contract the run was not created under.
// Returns null after emitting the exit-0 refusal when neither holds.
function ensureRunbook(
  root: string,
  dir: string,
  runId: string,
  state: MigrateRunState
): string | null {
  const filePath = join(dir, state.runbookPath ?? RUNBOOK_FILE_NAME);
  const stat = lstatRunbook(filePath);
  if (stat?.isFile()) {
    // The read is the proof the entry is usable: a runbook the agent cannot
    // read must not pass the guard, so read errors (an unreadable mode, an
    // I/O failure) propagate before the run advances. The read goes through
    // a descriptor: O_NOFOLLOW makes a symlink swapped in after the lstat
    // fail the open (ELOOP) instead of being followed, and O_NONBLOCK stops
    // a planted FIFO blocking the open (same guard as owned-private-dir.ts).
    const fd = openSync(
      filePath,
      fsConstants.O_RDONLY |
        (fsConstants.O_NOFOLLOW ?? 0) |
        (fsConstants.O_NONBLOCK ?? 0)
    );
    try {
      // The descriptor must be the inspected regular file itself. The inode
      // comparison carries the guarantee where the open flags cannot:
      // Windows has neither O_NOFOLLOW nor O_NONBLOCK, so a followed
      // replacement shows up only as a different inode.
      const fdStat = fstatSync(fd, { bigint: true });
      if (
        !fdStat.isFile() ||
        fdStat.dev !== stat.dev ||
        fdStat.ino !== stat.ino
      ) {
        throw new Error(
          `${MIGRATE_RUNS_RELATIVE_DIR}/${runId}/${RUNBOOK_FILE_NAME} was replaced while being read; ${continueRunHint(
            runId
          )}`
        );
      }
      return readFileSync(fd, 'utf-8');
    } finally {
      closeSync(fd);
    }
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
    // Any other non-regular entry (a symlink most likely) would redirect the
    // re-render write below outside the run directory; unlink it, without
    // traversal. Removal failures propagate: falling through to the write
    // would follow a symlink that could not be removed.
    rmSync(filePath, { force: true });
  }
  if (state.nxVersion !== nxVersion) {
    const reason = [
      `The runbook for run '${runId}' is missing from ${MIGRATE_RUNS_RELATIVE_DIR}/${runId}, and this nx (${nxVersion}) cannot re-render the one nx ${singleLine(
        state.nxVersion
      )} wrote.`,
      `Restore the file, re-run with the nx version that created the run, or remove ${MIGRATE_RUNS_RELATIVE_DIR}/${runId} to abandon the run (migrations it already applied remain applied).`,
    ];
    warnToAgent({ title: reason[0], bodyLines: [reason[1]] });
    emitStepBlock(runId, '-', 'error', {
      instructions: reason.join('\n'),
    });
    return null;
  }
  const content = renderRunbook(runbookContext(root, runId, state));
  // Published via rename so no reader can ever observe a partial runbook at
  // the path: partial bytes only exist under the temp name, a crashed repair
  // leaves the path missing rather than truncated, and rename replaces
  // whatever sits at the destination (a concurrent repair's identical render,
  // or a re-planted symlink) without following it. The random suffix matches
  // writeRunState's temp naming: a pid would collide across PID namespaces
  // sharing the workspace, and each invocation must only ever touch its own
  // temp file. 'wx' creates without following links, so anything planted at
  // the temp name fails the repair instead of redirecting it.
  const tmpPath = `${filePath}~${randomBytes(4).toString('hex')}`;
  writeFileSync(tmpPath, content, { flag: 'wx' });
  renameSync(tmpPath, filePath);
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
    reconcileCommand: reconcileCommand(root, runId),
    createCommits: state.createCommits,
    // The same `!== false` read the flag itself gets, so a run recorded
    // without the field renders validation on.
    validate: state.validate !== false,
  };
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
  // Version refusal (NewerRunStateFormatError) propagates.
  let state = readRunState(dir);

  // Ignore/index state can change while a durable run is paused (a checkout,
  // a .gitignore edit, a forced add); re-verify before foldHandoffs, which
  // can itself commit a settled prompt step.
  if (state.createCommits) {
    assertScratchDirSafeForCommits(root, continueRunHint(runId));
  }

  // The runbook is the run's persisted contract, and reconcile is the command
  // a compacted or restarted session recovers through; read, repair, or
  // refuse it here, before any fold or dispense, so the run can never advance
  // while the contract is unavailable. A completed run owes no recovery, and
  // neither does an active run whose steps are all terminal: no work can
  // advance, the only thing left is to persist and emit the self-contained
  // terminal response, and hiding it behind a missing contract would leave
  // the run active forever.
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
    const result = applyReconcileStepAction(root, state, stepAction);
    if (result.kind === 'error') {
      emitError(root, runId, result.reason);
      return; // state untouched
    }
    const target = result.targetStep;
    // An adopted death commits its working tree; that git side effect runs
    // before the lock (locked sections must stay synchronous), then the
    // transition and its ledger entry land in one fresh-state write so a
    // crash can't leave the step succeeded unrecorded. As with a fold, that
    // window is wide, and a rejected reapply after the commit landed is
    // equivalent to commitForStep's crash-refold window: the commit stays in
    // history, the ledger misses it, and the rejection names it below so the
    // agent re-decides against the moved HEAD.
    // Without commits the adopted tree is still this migration's result, and
    // it can carry package.json edits the dead worker never installed; the
    // install has to run here or the next dispense captures the modified
    // dependencies as its own baseline and nothing is left to detect them.
    // A skip leaves the tree as it stands too, so it owes the same install
    // and, with commits on, the same debt record as a prompt that did not
    // complete. Retries owe nothing: the rearmed attempt reconciles itself.
    const { entry, installFailed }: StepSideEffects =
      stepAction === 'adopt'
        ? state.createCommits
          ? await commitForStep(root, dir, state, target)
          : {
              entry: null,
              installFailed: await installFailedForStep(
                root,
                dir,
                state,
                target
              ),
            }
        : stepAction === 'skip'
          ? await retainedTreeSideEffects(root, dir, state, target)
          : { entry: null, installFailed: false };
    // A rearm starts a fresh attempt; drop the stale handoff before the rearm
    // is persisted so a crash in between can't refold the old outcome into the
    // new attempt. Losing the handoff without the rearm is safe: the step is
    // still failed/died and the agent re-issues the action.
    if (stepAction === 'retry' || stepAction === 'retry-clean') {
      removeHandoff(dir, target.migrationId);
      // A reset-backed retry that dropped the generator marker reruns the
      // generator, so payloads stored by earlier attempts describe a run
      // whose tree was reset away; remove them. Hygiene, not the correctness
      // boundary: the lineage bound persisted with the next marker
      // (generatorCompletedAtAttempt) is what keeps a later retry from
      // re-handing a copy this best-effort removal missed. A plain retry
      // keeps the files: its lineage is unbroken, and a retained retry
      // re-hands the newest copy. Removed with the handoff, before the rearm
      // is persisted: losing them without the rearm only costs a later
      // emission its stored copy.
      if (
        stepAction === 'retry-clean' &&
        result.state.steps.find((s) => s.id === target.id)
          .generatorCompleted !== true
      ) {
        removeAgentWorkPayloads(dir, target.id, target.attempt);
      }
    }
    // Re-validate the transition against the fresh disk state: if a concurrent
    // reconcile already resolved this step, surface the state machine's own
    // rejection through the same emitError path rather than writing over it.
    // The bound attempt keeps the acceptance checks above honest: they ran
    // against `state`, and a step that was re-armed and failed again in
    // between is a different attempt those checks never saw.
    let freshRejection: string | undefined;
    const written = updateRunState(dir, (fresh) => {
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
      const next = installFailed
        ? markInstallFailed(reapplied.state, target.id)
        : reapplied.state;
      return entry ? appendCommit(next, entry) : next;
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
    state = written;
  }
  // (d) choose and emit the next dispense.
  advanceAndDispense(root, dir, runId, state);
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

// --- reconcile phases -------------------------------------------------------

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
    const result = readHandoffWithReason(
      handoffPath(dir, splitMigrationId(step.migrationId))
    );
    if (!result.ok) continue; // still awaiting; the dispense asks to settle it
    let promptOutcome = handoffToPromptOutcome(result.handoff);
    // A skipped handoff on a step whose generator applied changes (a
    // validation pass, or a hybrid's prompt half) is not a skipped migration:
    // those changes are in the tree, so the step completes and its commit
    // lands. Folding it as 'skipped' would report the migration as not run
    // and strand the changes as commit debt. A prompt-only step never carries
    // the marker, and a hybrid whose generator was a no-op left nothing to
    // land, so both fold as recorded: committing there would `git add -A`
    // unrelated pending diffs under a migration that changed nothing.
    if (generatorChangesApplied(step) && promptOutcome.status === 'skipped') {
      promptOutcome = { ...promptOutcome, status: 'completed' };
    }
    // The commit and the install are side effects, so they happen before the
    // fold, outside the lock; the transition and its ledger entry then land in
    // one fresh-state write. A crash cannot leave the step settled with its
    // commit forgotten.
    const { entry, installFailed } = await foldLedgerEntry(
      root,
      dir,
      current,
      step,
      promptOutcome
    );
    // The fold re-validates against fresh disk state, on the attempt this
    // handoff was read for. That window is wide (a git commit plus a package
    // install), and 'awaiting-prompt-outcome' recurs, so without the attempt
    // check a concurrent reconcile's retry could take this outcome as its own.
    // A dropped fold is equivalent to the crash-refold window: the commit
    // landed but the ledger misses it.
    let folded = false;
    current = updateRunState(dir, (fresh) => {
      const applied = applyStepEvent(fresh, {
        type: 'foldPromptOutcome',
        stepId: step.id,
        attempt: step.attempt,
        promptOutcome,
      });
      if (applied.kind === 'error') return null;
      folded = true;
      const next = installFailed
        ? markInstallFailed(applied.state, step.id)
        : applied.state;
      return entry ? appendCommit(next, entry) : next;
    });
    // Only the handoff this fold consumed is removed. A rejected fold leaves
    // it in place: it belongs to whichever attempt is on disk now, and that
    // attempt's own reconcile still has to read it. The stored agent-work
    // payloads go with a terminal outcome; a failed fold keeps them, since a
    // retry re-hands the newest surviving copy.
    if (folded) {
      removeHandoff(dir, step.migrationId);
      if (promptOutcome.status !== 'failed') {
        removeAgentWorkPayloads(dir, step.id, step.attempt);
      }
    }
  }
  return current;
}

// What a folded prompt outcome owes the run state. A completed prompt with
// commits on is committed and its result classified as usual, the install
// riding in on the commit path. Every other outcome still reconciles the
// dependencies itself: the prompt (or the generator half before it) can have
// edited package.json whether or not it completed, and skipping the install
// there strands that change with nothing left to detect it, since the next
// step's dispense captures the already-modified state as its own baseline.
//
// A failed or skipped prompt is not committed, but it can still have left
// edits behind, so a tree that is not verifiably clean records debt: the
// changes then read as pending for a later commit to absorb, and the
// completion warning knows about them. A failed probe counts as dirty,
// matching every other retry-safety decision in this file; debt a later landed
// entry covers costs nothing.
async function foldLedgerEntry(
  root: string,
  dir: string,
  state: MigrateRunState,
  step: MigrateStep,
  promptOutcome: MigrateStepPromptOutcome
): Promise<StepSideEffects> {
  if (promptOutcome.status === 'completed') {
    if (state.createCommits) {
      return commitForStep(root, dir, state, step);
    }
    return {
      entry: null,
      installFailed: await installFailedForStep(root, dir, state, step),
    };
  }
  return retainedTreeSideEffects(root, dir, state, step);
}

// Shared by prompts that did not complete and by skipped failed or died steps:
// the tree is kept as it stands, so the step still owes the install of any
// dependency edits it left and, with commits on, a debt record when the tree
// is not verifiably clean (see foldLedgerEntry for why).
async function retainedTreeSideEffects(
  root: string,
  dir: string,
  state: MigrateRunState,
  step: MigrateStep
): Promise<StepSideEffects> {
  const installFailed = await installFailedForStep(root, dir, state, step);
  const entry =
    state.createCommits && getWorkingTreeStatus(root) !== 'clean'
      ? { kind: 'failed' as const, stepIds: [step.id] }
      : null;
  return { entry, installFailed };
}

// Installs the dependency changes a step's tree may carry when no commit path
// will do it (the fold of a prompt outcome that lands no commit, or a
// non-commit adopt), returning whether the install failed. A failure is
// recorded rather than thrown: reconcile still owes the agent a dispense, and
// a warning alone dies with this process.
async function installFailedForStep(
  root: string,
  dir: string,
  state: MigrateRunState,
  step: MigrateStep
): Promise<boolean> {
  try {
    await installDepsChangedSinceDispense(
      root,
      dir,
      step,
      state.skipInstall === true,
      reconcileCommand(root, state.runId)
    );
    return false;
  } catch (e) {
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

function applyReconcileStepAction(
  root: string,
  state: MigrateRunState,
  action: StepAction
):
  | { kind: 'ok'; state: MigrateRunState; targetStep: MigrateStep }
  | { kind: 'error'; reason: string } {
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
  // A retry-clean the dispense would not have offered must be refused here
  // too, or a hand-crafted reconcile could reset a tree with no restore point
  // and destroy prior steps' work.
  if (action === 'retry-clean') {
    const head = getLatestCommitSha(root);
    const fallback =
      step.status === 'died'
        ? `Use 'adopt' or 'skip' instead.`
        : `Use 'retry' or 'skip' instead.`;
    if (!canOfferCleanRetry(root, state, step, head)) {
      return {
        kind: 'error',
        reason: `Cannot apply action 'retry-clean' to step '${
          step.id
        }': ${cleanRetryUnavailableReason(root, state, step, head)} ${fallback}`,
      };
    }
    // The reset itself is delegated to the caller, and every check above
    // passes identically whether or not it ran, so only the tree can say
    // whether the reset actually happened. Anything but a verified-clean tree
    // is refused: accepting would drop the generator marker and rerun the
    // generator over the previous attempt's output.
    if (getWorkingTreeStatus(root) !== 'clean') {
      return {
        kind: 'error',
        reason: `Cannot apply action 'retry-clean' to step '${step.id}': the working tree is not verifiably clean, so the reset this action requires has not happened. Run \`git reset --hard ${step.gitRefBefore}\` then \`git clean -fd -e ${MIGRATE_RUNS_RELATIVE_DIR}\` first, then re-run it. ${fallback}`,
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
        reason: `Cannot apply action 'retry' to step '${step.id}': ${safety.reason} Use 'retry-clean' where offered, or 'skip'.`,
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
  return { kind: 'ok', state: applied.state, targetStep: step };
}

// What a reconcile's git and install side effects owe the run state, applied
// in the same locked write as the step transition they belong to. The two are
// independent: a step can be committed with its dependencies uninstalled, and
// the ledger says nothing about the latter.
interface StepSideEffects {
  entry: MigrateCommitLedgerEntry | null;
  installFailed: boolean;
}

// Commits the working tree left by a folded prompt outcome or an adopted
// death, returning the ledger entry the caller persists together with the
// step transition (null when there was nothing to commit). The worker's
// recorded-commit path classifies through the same commitResultToLedgerEntry.
//
// Remaining narrow window: a crash after the git commit but before the state
// write refolds on the next reconcile, where the commit attempt sees a clean
// tree ('no-changes') and the ledger simply misses that landed entry; the
// changes themselves are never lost. A lost landed entry can also strand the
// failed entries it had absorbed, which is why completion double-checks the
// tree before warning about debt.
async function commitForStep(
  root: string,
  dir: string,
  state: MigrateRunState,
  step: MigrateStep
): Promise<StepSideEffects> {
  const { name } = splitMigrationId(step.migrationId);
  const absorbedStepIds = uncoveredFailedStepIds(state).filter(
    (id) => id !== step.id
  );
  let result: Awaited<ReturnType<typeof commitMigrationIfRequested>>;
  try {
    result = await commitMigrationIfRequested(
      root,
      { name },
      true,
      state.commitPrefix,
      () =>
        installDepsChangedSinceDispense(
          root,
          dir,
          step,
          state.skipInstall === true,
          reconcileCommand(root, state.runId)
        ),
      stepsToPendingMigrations(state, absorbedStepIds)
    );
  } catch (e) {
    // The dependency install is the only thing that throws here: the commit
    // attempt itself reports through result.status, and the install's own
    // bookkeeping never throws. Both consequences are recorded, and neither
    // aborts reconcile so the next dispense still fires. The debt cannot stand
    // in for the install failure: a later step's commit absorbs this diff and
    // lands an entry naming this step, which clears the debt while the
    // dependencies are still missing.
    warnCommitFailed(name, e);
    return {
      entry: { kind: 'failed', stepIds: [step.id] },
      installFailed: true,
    };
  }
  if (result.status === 'failed') {
    warnCommitFailed(name);
  }
  return {
    entry: commitResultToLedgerEntry(result, step.id, absorbedStepIds),
    installFailed: false,
  };
}

// --- dispense ---------------------------------------------------------------

function advanceAndDispense(
  root: string,
  dir: string,
  runId: string,
  state: MigrateRunState
): void {
  const step = firstActionableStep(state);
  if (!step) {
    completeRun(root, dir, runId, state);
    return;
  }
  switch (step.status) {
    case 'pending':
      dispenseNextStep(root, dir, runId, state, step);
      break;
    case 'dispensed':
      // Re-entry before the worker advanced the step; re-emit its command.
      emitNextStep(root, runId, step);
      break;
    case 'failed':
      emitRetryFailed(root, runId, state, step);
      break;
    case 'died':
      emitDied(root, runId, state, step);
      break;
    case 'running':
      emitStillRunning(root, runId, step);
      break;
    case 'awaiting-prompt-outcome':
      emitAwaitPrompt(root, dir, runId, state, step);
      break;
    case 'succeeded':
    case 'skipped':
      // firstActionableStep already excludes these via TERMINAL_STATUSES;
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

function firstActionableStep(state: MigrateRunState): MigrateStep | undefined {
  return state.steps.find((s) => !TERMINAL_STATUSES.has(s.status));
}

function dispenseNextStep(
  root: string,
  dir: string,
  runId: string,
  state: MigrateRunState,
  step: MigrateStep
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
  const current = updateRunState(dir, (fresh) => {
    // A concurrent init or reconcile may have dispensed (or further advanced)
    // this step since the caller's read; reclassify against the fresh state
    // below instead of failing the duplicate transition.
    if (fresh.steps.find((s) => s.id === step.id)?.status !== 'pending') {
      advancedElsewhere = true;
      return null;
    }
    const dispensed = applyEventOrThrow(fresh, {
      type: 'dispense',
      stepId: step.id,
    });
    return setDispenseBaselines(dispensed, step.id, baselines);
  });
  if (advancedElsewhere) {
    // Terminates: step statuses only advance, so each re-entry observes
    // strictly later state and lands in a non-pending branch of the dispatch.
    advanceAndDispense(root, dir, runId, current);
    return;
  }
  emitNextStep(
    root,
    runId,
    current.steps.find((s) => s.id === step.id)
  );
}

function emitNextStep(root: string, runId: string, step: MigrateStep): void {
  const migrationId = step.migrationId;
  emit(root, runId, step, 'next-step', {
    command: workerCommand(root, migrationId, runId),
    next: reconcileCommand(root, runId),
    instructionLines: [
      `Apply migration ${migrationId} by running the command below, then run the "next" command to record the outcome and get the next step.`,
    ],
  });
}

function emitRetryFailed(
  root: string,
  runId: string,
  state: MigrateRunState,
  step: MigrateStep
): void {
  const migrationId = step.migrationId;
  // A worker failure records its summary on the outcome; a prompt the agent
  // reported as failed carries the agent's own reason on the prompt outcome.
  const summary = step.outcome?.summary ?? step.promptOutcome?.summary;
  const head = getLatestCommitSha(root);
  const tree = dirtyTreeSummary(root);
  const cleanRetry = canOfferCleanRetry(root, state, step, head);
  // A failure recorded before the generator marker can still have written to
  // the tree (a direct fs or exec side effect, or a crash mid-flush); a
  // marker means only the install and commit are left, so plain retry is
  // safe outright. So is retrying a step with no generator half to rerun.
  const pending = generatorPending(step);
  const retrySafety: PreMarkerRetrySafety = pending
    ? assessPreMarkerRetry(root, step)
    : { kind: 'safe' };
  const lines = [
    `Migration ${migrationId} failed${summary ? `: ${summary}` : ''}.`,
    `  started from: ${step.gitRefBefore ?? '(unknown)'}`,
    `  current HEAD: ${head ?? '(unknown)'}`,
    `  working tree: ${tree === null ? '(unknown)' : tree ? `\n${tree}` : '(clean)'}`,
    ``,
    `Decide how to proceed and re-run reconcile with one of:`,
    retryOptionLine(retrySafety, reconcileCommand(root, runId, 'retry')),
  ];
  if (cleanRetry) {
    lines.push(
      `  retry-clean: restore the tree to ${
        step.gitRefBefore ?? 'the pre-migration ref'
      } first (e.g. \`git reset --hard ${step.gitRefBefore ?? '<ref>'}\` then \`git clean -fd -e ${MIGRATE_RUNS_RELATIVE_DIR}\`, keeping the run state out of the clean), then retry from that clean state by running: ${reconcileCommand(
        root,
        runId,
        'retry-clean'
      )}`
    );
  }
  lines.push(`  skip:  ${reconcileCommand(root, runId, 'skip')}`);
  if (pending) {
    lines.push(UNVERIFIABLE_WRITES_LINE);
  }
  // A step whose generator may still run gets no `next`, whichever retry the
  // checks above would accept: git can vouch for the tracked tree only, and
  // an agent that follows `next` blindly must not rerun a generator over
  // writes nothing here could see. Choosing a retry has to be explicit.
  emit(root, runId, step, 'retry-failed', {
    ...(pending ? {} : { next: reconcileCommand(root, runId, 'retry') }),
    instructionLines: lines,
  });
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

// Whether the step's generator half ran and left changes in the tree: the
// marker is recorded and it is not an explicit no-op. Decides how a skipped
// handoff folds and whether the dispense offers the skipped outcome. Absent
// generatorMadeChanges (a marker an older nx wrote) counts as applied,
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

// A clean retry resets the tree to the step's captured pre-migration ref.
// That is only safe when every prior diff is already committed: without
// per-migration commits the ref is the run's starting commit (the reset would
// wipe all prior steps' uncommitted work); a failed init checkpoint or a
// pending step commit means the ref predates diffs the reset would also
// destroy; without a captured ref there is nothing to reset to; edits already
// in the tree when this step was dispensed (the user's own, or an earlier
// step's the checkpoint never saw) are not represented by the ref either; and
// HEAD anywhere other than the ref means something was committed since the
// step was dispensed that the reset would discard, whether that is this step's
// own commit (recorded, or made in the window before the worker died writing
// its ledger entry) or one the user made alongside the run.
// Cleanliness and position both have to say so explicitly: a failed tree probe
// records dirty, a run created before that field existed carries nothing to
// check, and an unreadable HEAD is no ref at all, so none of the three can be
// read as a restore point that exists.
function canOfferCleanRetry(
  root: string,
  state: MigrateRunState,
  step: MigrateStep,
  head: string | null
): boolean {
  return (
    state.createCommits &&
    !state.checkpointFailed &&
    !hasPendingCommitDebt(state) &&
    !!step.gitRefBefore &&
    head === step.gitRefBefore &&
    step.treeCleanAtDispense === true &&
    !endangeredLandedEntry(root, state, step)
  );
}

// The last landed ledger entry covering the step whose commit a reset to the
// step's gitRefBefore would discard. Entries from earlier attempts predate the
// ref re-captured at re-dispense and survive the reset; only a commit that is
// not an ancestor of the ref (or cannot be verified as one) is endangered.
function endangeredLandedEntry(
  root: string,
  state: MigrateRunState,
  step: MigrateStep
): MigrateCommitLedgerEntry | null {
  let endangered: MigrateCommitLedgerEntry | null = null;
  for (const entry of coveringLandedEntries(state, step.id)) {
    if (
      !entry.sha ||
      !step.gitRefBefore ||
      !isAncestorCommit(entry.sha, step.gitRefBefore, root)
    ) {
      endangered = entry;
    }
  }
  return endangered;
}

// Explains why retry-clean is withheld for a failed or died step; feeds the
// death dispense and a rejected --step-action=retry-clean.
function cleanRetryUnavailableReason(
  root: string,
  state: MigrateRunState,
  step: MigrateStep,
  head: string | null
): string {
  const endangered = endangeredLandedEntry(root, state, step);
  if (endangered) {
    return endangered.sha
      ? `this migration's changes already landed in commit ${endangered.sha}, which a reset would discard.`
      : `this migration's changes already landed in a commit, which a reset would discard.`;
  }
  if (step.gitRefBefore && head !== step.gitRefBefore) {
    return `HEAD is at ${head ?? '(unreadable)'} rather than the ${
      step.gitRefBefore
    } this migration started from, so a reset would discard what was committed in between.`;
  }
  return `resetting the tree could discard uncommitted work that no restore point accounts for.`;
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

function emitDied(
  root: string,
  runId: string,
  state: MigrateRunState,
  step: MigrateStep
): void {
  const migrationId = step.migrationId;
  const ref = step.gitRefBefore;
  const head = getLatestCommitSha(root);
  const tree = dirtyTreeSummary(root);
  const cleanRetry = canOfferCleanRetry(root, state, step, head);
  // The generator half is recorded (or the step never had one), so a retry
  // that keeps the tree as it stands has the rest of the step left to run: a
  // prompt, or the install and commit its worker never reached.
  const resume = !generatorPending(step);
  const lines = [
    `The worker for ${migrationId} died; its process is gone.`,
    `  started from: ${ref ?? '(unknown)'}`,
    `  current HEAD: ${head ?? '(unknown)'}`,
    `  working tree: ${tree === null ? '(unknown)' : tree ? `\n${tree}` : '(clean)'}`,
    ``,
  ];
  const options: string[] = [];
  if (resume) {
    options.push(
      `  retry: keep everything this migration already produced (its commit, if any, and the current tree) and run only the part that did not complete, then run: ${reconcileCommand(
        root,
        runId,
        'retry'
      )}`
    );
  }
  if (cleanRetry) {
    options.push(
      // Two commands rather than one `&&` chain: the agent runs these in its
      // own shell, and not every shell joins statements that way.
      `  retry-clean: restore the tree to ${
        ref ?? 'the pre-migration ref'
      } first (e.g. \`git reset --hard ${ref ?? '<ref>'}\` then \`git clean -fd -e ${MIGRATE_RUNS_RELATIVE_DIR}\`, keeping the run state out of the clean), then retry from that clean state by running: ${reconcileCommand(
        root,
        runId,
        'retry-clean'
      )}`
    );
  } else {
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
    )}`,
    `  skip: leave the tree as it stands and move on without this migration, then run: ${reconcileCommand(
      root,
      runId,
      'skip'
    )}`
  );
  lines.push(`Choose exactly one:`);
  lines.push(...options);
  if (!resume) {
    lines.push(UNVERIFIABLE_WRITES_LINE);
  }
  // `retry` is preselected wherever it is legal: it is the only resolution
  // that neither discards work nor records a result the run never produced.
  // While the generator may still run there is no `next` at all: a reset
  // cannot be verified against writes git does not see, and adopting records
  // a result nothing checked, so an agent that follows `next` blindly must
  // land on neither.
  emit(root, runId, step, 'died', {
    ...(resume ? { next: reconcileCommand(root, runId, 'retry') } : {}),
    instructionLines: lines,
  });
}

function emitStillRunning(
  root: string,
  runId: string,
  step: MigrateStep
): void {
  const migrationId = step.migrationId;
  const ageMs = step.startedAt ? Date.now() - Date.parse(step.startedAt) : 0;
  const lines = [
    `The worker for ${migrationId} (pid ${step.pid}) is still running. Wait for it to finish, then run the "next" command.`,
  ];
  if (ageMs >= HANG_THRESHOLD_MS) {
    lines.push(
      `It has been running for ${Math.floor(
        ageMs / 60000
      )} minutes and may be hung. Verify pid ${step.pid}; either keep waiting, or kill it so the next reconcile can classify it as died.`
    );
  }
  emit(root, runId, step, 'still-running', {
    next: reconcileCommand(root, runId),
    instructionLines: lines,
  });
}

function emitAwaitPrompt(
  root: string,
  dir: string,
  runId: string,
  state: MigrateRunState,
  step: MigrateStep
): void {
  const migrationId = step.migrationId;
  const { package: pkg, name } = splitMigrationId(migrationId);
  const filePath = handoffPath(dir, { package: pkg, name });
  // The package id becomes real path segments, so handing over the path
  // without its directory is what would force the agent to `mkdir -p`. Same
  // reason the classic runner pre-creates it in run-step.ts.
  mkdirSync(dirname(filePath), { recursive: true });
  const validating = step.awaitingKind === 'generator-validation';
  // The plan's prompt path is the ground truth for a prompt park: it anchors
  // the stored-copy check (a same-migration file naming different
  // instructions is rejected) and is what the fallback below re-hands.
  const planPrompt = validating
    ? null
    : planPromptPath(dir, state, migrationId);
  // Re-emit the payload the worker stored when it parked the step, so a
  // session that lost the original block (a compaction, a restart) gets the
  // work restated instead of a pointer into stdout it no longer has. When no
  // stored copy is usable (the park predates the stored copy, or the file no
  // longer matches the awaited work), the payload is synthesized from
  // durable facts instead: the tree-pointing validation marker, or the
  // plan's prompt path. An awaiting step offers no retry action, so a
  // dispense that only pointed backward could stall a valid run forever.
  // Only a plan that cannot name the prompt leaves the backward pointer, as
  // the last resort.
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
      ];
  lines.push(
    `Handoff file: ${filePath}`,
    // No skipped outcome is offered once a generator's changes are applied
    // (a validation pass, or a hybrid's prompt half): "not applicable" still
    // completes the migration, and the fold treats a skipped handoff that
    // way. A prompt-only step, or a hybrid whose generator was a no-op, can
    // still be marked skipped: nothing of the migration is in the tree.
    validating
      ? `Handoff JSON: { "status": "success" | "failed", "summary": "<what you verified>" }. If validation does not apply here, use "status": "success" and say so in the summary.`
      : generatorChangesApplied(step)
        ? `Handoff JSON: { "status": "success" | "failed", "summary": "<what you did>" }. If the prompt does not apply here, use "status": "success" and say so in the summary; the migration's generator changes are already applied.`
        : `Handoff JSON: { "status": "success" | "failed", "summary": "<what you did>" }. To mark the prompt not applicable, use "status": "success" with "outcome": "skipped".`
  );
  // A handoff that exists but can't be read/parsed/validated is a rejection,
  // not a still-awaited outcome. Naming why stops the run from re-emitting the
  // same await forever while the agent leaves the bad file in place.
  const rejection = describeRejectedHandoff(filePath);
  if (rejection.length > 0) {
    lines.push('', ...rejection);
  }
  emit(root, runId, step, 'await-prompt', {
    next: reconcileCommand(root, runId),
    instructionLines: lines,
  });
}

// The prompt path the run's latest plan snapshot records for the migration;
// null when the snapshot cannot be read, is not the shape nx writes, or does
// not name one. A damaged-but-parseable snapshot must land on null too: this
// runs while re-handing an awaiting step's work, and throwing here would
// keep the run from re-dispensing that work at all. The snapshot name is
// validated as a bare `plan-<round>.json` at state read, so the join cannot
// leave the run directory.
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

// Empty unless a handoff file is present but unusable; wording mirrors the
// classic runner's ambiguous-outcome cause lines.
function describeRejectedHandoff(handoffPath: string): string[] {
  const result = readHandoffWithReason(handoffPath);
  if (result.ok) return [];
  const { reason, detail } = result as {
    ok: false;
    reason: HandoffReadFailureReason;
    detail?: string;
  };
  if (reason === 'missing') return [];
  const followUp = 'Rewrite the handoff file, then run the "next" command.';
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

function completeRun(
  root: string,
  dir: string,
  runId: string,
  state: MigrateRunState
): void {
  let current = state;
  const completed = current.steps.filter(
    (s) => s.status === 'succeeded'
  ).length;
  const skipped = current.steps.filter((s) => s.status === 'skipped').length;
  const dispenseCount = current.steps.reduce((n, s) => n + s.dispenseCount, 0);
  // The crash-refold window can strand a failed ledger entry whose diff was in
  // fact absorbed; suppress the warning only on a verified-clean tree. A dirty
  // tree can still be unrelated edits, so the warning only claims the changes
  // "may remain".
  const commitDebt =
    hasPendingCommitDebt(current) && getWorkingTreeStatus(root) !== 'clean';

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
    reportMigrateOrchestratorComplete({
      completed,
      skipped,
      dispenseCount,
    });
  }

  const debtLine =
    'Some migration changes could not be committed and may remain in the working tree; review and commit them manually.';
  if (commitDebt) {
    warnToAgent({ title: debtLine });
  }
  const uninstalled = current.steps.filter((s) => s.installFailed);
  const installLine =
    uninstalled.length > 0
      ? `The dependency changes made by ${uninstalled
          .map((s) => s.migrationId)
          .join(', ')} were not installed; run \`${pmInstallCommand(
          root
        )}\` before using the workspace.`
      : null;
  if (installLine) {
    warnToAgent({ title: installLine });
  }
  const instructionLines = [
    `Migrate run ${runId} is complete.`,
    `  applied: ${completed}`,
    `  skipped: ${skipped}`,
    ...(commitDebt ? [debtLine] : []),
    ...(installLine ? [installLine] : []),
  ];
  logToAgent({ title: 'nx migrate: complete', bodyLines: instructionLines });
  emitStepBlock(runId, '-', 'complete', {
    instructions: instructionLines.join('\n'),
  });
}

// --- output -----------------------------------------------------------------

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
  step: MigrateStep,
  action: string,
  payload: DispensePayload
): void {
  const { instructionLines, ...rest } = payload;
  const withFooter = instructionLines
    ? [...instructionLines, ...runbookFooterLines(root, runId)]
    : undefined;
  // One sanitized array feeds both, so the block payload says exactly what the
  // human echo said.
  const lines = withFooter ? safeLines(withFooter) : undefined;
  logToAgent({ title: `nx migrate: ${action}`, bodyLines: lines });
  emitStepBlock(runId, step.id, action, {
    ...rest,
    ...(lines ? { instructions: lines.join('\n') } : {}),
  });
  reportMigrateOrchestratorDispense({ action, attempt: step.attempt });
}

// Appended to every step dispense and rejected-action response so a session
// that lost its context is always one line away from the contract. The
// complete output and the missing-runbook refusal (which cannot point at a
// readable file) stand alone. Reconcile ensures the file before dispensing;
// the lstat gate covers the paths that legitimately skip that recovery (a
// completed run's rejected action) without ever naming a non-regular entry.
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

// --- helpers ----------------------------------------------------------------

function appendCommit(
  state: MigrateRunState,
  entry: MigrateCommitLedgerEntry
): MigrateRunState {
  return { ...state, commits: [...state.commits, entry] };
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

function handoffPath(
  dir: string,
  migration: { package: string; name: string }
): string {
  return stepHandoffPath(dir, migration);
}

function removeHandoff(dir: string, migrationId: string): void {
  rmSync(handoffPath(dir, splitMigrationId(migrationId)), { force: true });
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
