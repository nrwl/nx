import { execSync } from 'child_process';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { writeJsonFile } from '../../../utils/fileutils';
import {
  getLatestCommitSha,
  getPathCommitExposure,
  getWorkingTreeStatus,
  isAncestorCommit,
  type PathCommitExposure,
} from '../../../utils/git-utils';
import { output } from '../../../utils/output';
import { nxVersion } from '../../../utils/versions';
import {
  stepHandoffPath,
  readHandoffWithReason,
  type HandoffReadFailureReason,
} from '../agentic/handoff';
import { applyAgenticHandoffGitignoreFallback } from '../agentic/handoff-gitignore';
import type { HandoffFile } from '../agentic/types';
import { ChangedDepInstaller } from '../execute-migration';
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
  readRunState,
  runDir,
  CURRENT_RUN_STATE_FORMAT_VERSION,
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
  splitMigrationId,
  stepsToPendingMigrations,
  uncoveredFailedStepIds,
  type StepAction,
  type StepEvent,
} from './state-machine';
import { escapeXmlAttr } from '../agentic/print-dropped-agent-context';
import type { PlannedMigration } from '../migration-shape';
import { isPidAlive, nowIso, pmExecPrefix, warnCommitFailed } from './util';

// The dark migrate orchestrator: drives a durable run one dispense at a time.
// An outer AI agent runs each dispensed command and re-invokes `nx migrate
// --run-id=<id>` to reconcile; there is no long-lived process.

const RUN_STATE_FILE_NAME = 'run.json';
const PLAN_SNAPSHOT_0 = 'plan-0.json';
// A running worker older than this may be hung; the still-running dispense
// escalates so the agent can verify or kill it.
const HANG_THRESHOLD_MS = 15 * 60 * 1000;

// Steps in these statuses are done; every other status needs a dispense.
const TERMINAL_STATUSES = new Set<MigrateStepStatus>(['succeeded', 'skipped']);

// Dispensed commands are executed verbatim by the outer agent's shell, so
// hostile ids are refused up front rather than quoted per-platform (POSIX
// quoting is no defense in cmd.exe).
const SHELL_SAFE_VALUE = /^[A-Za-z0-9@/:._-]+$/;

export interface RunOrchestratorInitInput {
  root: string;
  // The full parsed migrations.json, snapshotted verbatim as plan-0.json.
  migrationsJson: { migrations?: PlannedMigration[]; [k: string]: unknown };
  createCommits: boolean;
  commitPrefix: string;
  // Workspace-local nx version; the v23 cutoff for the .gitignore fallback.
  installedNxVersion: string;
}

export interface RunOrchestratorReconcileInput {
  root: string;
  runId: string;
  stepAction?: StepAction;
}

// Dispensed commands use POSIX env-prefix syntax, invalid in both cmd.exe and
// PowerShell. Until Windows support lands, refuse up front rather than
// initializing a run whose dispensed commands cannot execute. The remediation
// differs per entry point: init can fall back to the standard flow, but an
// existing run can only be continued off-Windows or abandoned (the standard
// flow cannot resume it, and a restart would re-apply finished migrations).
function assertPlatformSupported(remediation: string): void {
  if (process.platform === 'win32') {
    throw new Error(
      `The orchestrated migrate flow is not supported on Windows yet. ${remediation}`
    );
  }
}

// The run scratch path as git sees it, relative to the workspace root.
const MIGRATE_RUNS_PATH = '.nx/migrate-runs';

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
    getPathCommitExposure(MIGRATE_RUNS_PATH, root),
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
        `Files under ${MIGRATE_RUNS_PATH} are committed to git, and ignore rules do not apply to tracked files, so migrate's commits would keep capturing this run's scratch state. ` +
          `Untrack them with \`git rm -r --cached ${MIGRATE_RUNS_PATH}\`, commit that change, make sure .gitignore lists ${MIGRATE_RUNS_PATH}, then ${thenWhat}`
      );
    case 'unignored':
      throw new Error(
        `${MIGRATE_RUNS_PATH} is not ignored by git, so migrate's commits would capture this run's scratch state. ` +
          `Add a \`${MIGRATE_RUNS_PATH}\` entry to .gitignore, then ${thenWhat}`
      );
    case 'unknown':
      throw new Error(
        `Could not verify with git that ${MIGRATE_RUNS_PATH} is ignored, so migrate's commits could capture this run's scratch state. ` +
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
  assertPlatformSupported(
    'Unset NX_MIGRATE_ORCHESTRATOR to use the standard migrate flow.'
  );
  const {
    root,
    migrationsJson,
    createCommits,
    commitPrefix,
    installedNxVersion,
  } = input;
  const planHash = computePlanHash(migrationsJson);

  // An active run means a prior init already happened (e.g. it crashed before
  // the agent's first reconcile); starting a second run would compete with it.
  // Same plan: resume it. Different plan: refuse (the plan-mismatch flow is a
  // later task). NewerRunStateFormatError propagates.
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
    ? getPathCommitExposure(MIGRATE_RUNS_PATH, root)
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
      getPathCommitExposure(MIGRATE_RUNS_PATH, root),
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
    mode: 'orchestrated',
    status: 'active',
    createCommits,
    commitPrefix,
    rounds: [
      {
        index: 0,
        planHash,
        planSnapshot: PLAN_SNAPSHOT_0,
      },
    ],
    steps: buildSteps(sorted),
    issues: [],
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
    createRun(root, state);
    return null;
  });
  if (winner) {
    resumeRun(root, winner.runId, winner.state);
    return;
  }

  finishInit(root, dir, runId, state);
}

// Reads the newest active run, refusing one whose plan differs from the
// incoming plan; null when no run is active. NewerRunStateFormatError
// propagates from the read.
function findActiveRunForPlan(
  root: string,
  planHash: string
): { runId: string; state: MigrateRunState } | null {
  const active = findActiveRun(root);
  if (active && latestRound(active.state)?.planHash !== planHash) {
    throw new Error(
      `A migrate run '${active.runId}' is already active with a different plan. ` +
        `Finish it first by running \`${reconcileCommand(root, active.runId)}\`, ` +
        `or remove .nx/migrate-runs/${active.runId} to abandon it.`
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
  // A run flagged checkpointFailed gets one more chance to capture the
  // pre-existing tree state before its first migration commit absorbs it.
  const resumed = ensureCheckpoint(root, dir, state);
  finishInit(root, dir, runId, resumed);
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
  if (
    state.steps.some((s) => s.kind === 'migration' && s.status !== 'pending')
  ) {
    return state;
  }
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
      fresh.steps.some((s) => s.kind === 'migration' && s.status !== 'pending')
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
    return { kind: 'checkpoint', sha: after, stepIds: [], issueIds: [] };
  }
  return null;
}

// Shared tail of a fresh and a resumed init: emit the init analytics once per
// run (watermark-guarded) and emit the current dispense.
function finishInit(
  root: string,
  dir: string,
  runId: string,
  state: MigrateRunState
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
        migrationCount: current.steps.filter((s) => s.kind === 'migration')
          .length,
        createCommits: current.createCommits,
      });
    }
  }
  advanceAndDispense(root, dir, runId, current);
}

export async function runOrchestratorReconcile(
  input: RunOrchestratorReconcileInput
): Promise<void> {
  assertPlatformSupported(
    'This run cannot be continued on Windows. Continue it from a non-Windows environment, or delete its directory under .nx/migrate-runs to abandon it; migrations it already applied remain applied.'
  );
  const { root, runId, stepAction } = input;
  if (!RUN_ID_SAFE.test(runId)) {
    throw new Error(`Invalid run id '${runId}'.`);
  }
  const dir = runDir(root, runId);
  if (!existsSync(join(dir, RUN_STATE_FILE_NAME))) {
    throw new Error(
      `No migrate run '${runId}' was found under .nx/migrate-runs. Start one with \`${pmExecPrefix(
        root
      )} nx migrate --run-migrations\` before reconciling.`
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
    // before the lock, then the transition and its ledger entry land in one
    // fresh-state write so a crash can't leave the step succeeded unrecorded.
    const entry =
      stepAction === 'adopt' &&
      state.createCommits &&
      target.kind === 'migration' &&
      target.migrationId
        ? await commitForStep(root, state, target)
        : null;
    // A rearm starts a fresh attempt; drop the stale handoff before the rearm
    // is persisted so a crash in between can't refold the old outcome into the
    // new attempt. Losing the handoff without the rearm is safe: the step is
    // still failed/died and the agent re-issues the action.
    if (
      (stepAction === 'retry' || stepAction === 'retry-clean') &&
      target.kind === 'migration' &&
      target.migrationId
    ) {
      removeHandoff(dir, target.migrationId);
    }
    // Re-validate the transition against the fresh disk state: if a concurrent
    // reconcile already resolved this step, surface the state machine's own
    // rejection through the same emitError path rather than writing over it.
    let freshRejection: string | undefined;
    const written = updateRunState(dir, (fresh) => {
      const reapplied = applyStepEvent(fresh, {
        type: 'stepAction',
        stepId: target.id,
        action: stepAction,
      });
      if (reapplied.kind === 'error') {
        freshRejection = reapplied.reason;
        return null;
      }
      return entry ? appendCommit(reapplied.state, entry) : reapplied.state;
    });
    if (freshRejection) {
      emitError(root, runId, freshRejection);
      return;
    }
    state = written;
  }
  // (d) choose and emit the next dispense.
  advanceAndDispense(root, dir, runId, state);
}

function buildSteps(sortedMigrations: PlannedMigration[]): MigrateStep[] {
  const steps: MigrateStep[] = [];
  let n = 0;
  const nextId = () => `step-${++n}`;
  steps.push(structuralStep(nextId(), 'peer-compat'));
  steps.push(structuralStep(nextId(), 'install'));
  for (const m of sortedMigrations) {
    steps.push({
      id: nextId(),
      roundIndex: 0,
      kind: 'migration',
      migrationId: `${m.package}:${m.name}`,
      status: 'pending',
      attempt: 1,
      dispenseCount: 0,
    });
  }
  steps.push(structuralStep(nextId(), 'final-validation'));
  return steps;
}

function structuralStep(id: string, kind: MigrateStep['kind']): MigrateStep {
  return {
    id,
    roundIndex: 0,
    kind,
    status: 'pending',
    attempt: 1,
    dispenseCount: 0,
  };
}

// --- reconcile phases -------------------------------------------------------

async function foldHandoffs(
  root: string,
  dir: string,
  state: MigrateRunState
): Promise<MigrateRunState> {
  let current = state;
  for (const step of state.steps) {
    if (step.status !== 'awaiting-prompt-outcome') continue;
    if (step.kind !== 'migration' || !step.migrationId) continue;
    const result = readHandoffWithReason(
      stepHandoffPath(dir, splitMigrationId(step.migrationId))
    );
    if (!result.ok) continue; // still awaiting; the dispense asks to settle it
    const promptOutcome = handoffToPromptOutcome(result.handoff);
    // A completed prompt still owns uncommitted tree changes; commit before the
    // fold (a git side effect stays outside the lock) so the transition and its
    // commit outcome land in one fresh-state write. A crash cannot leave the
    // step succeeded with its commit forgotten.
    const entry =
      promptOutcome.status === 'completed' && current.createCommits
        ? await commitForStep(root, current, step)
        : null;
    // The fold re-validates against fresh disk state. If a concurrent reconcile
    // already folded this step the fold is dropped (equivalent to the
    // crash-refold window: the commit landed but the ledger misses it).
    let folded = false;
    current = updateRunState(dir, (fresh) => {
      const applied = applyStepEvent(fresh, {
        type: 'foldPromptOutcome',
        stepId: step.id,
        promptOutcome,
      });
      if (applied.kind === 'error') return null;
      folded = true;
      return entry ? appendCommit(applied.state, entry) : applied.state;
    });
    // A folded handoff is consumed; leaving it would refold a later attempt.
    if (folded) removeHandoff(dir, step.migrationId);
  }
  return current;
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
  for (const step of state.steps) {
    // Only migration steps carry a real worker pid; structural placeholders are
    // driven synchronously and never left running across invocations.
    if (step.kind !== 'migration' || step.status !== 'running') continue;
    if (step.pid === undefined || isPidAlive(step.pid)) continue;
    // markDied re-validates against fresh disk state: if the worker finished
    // between this snapshot and the write, the transition is illegal on fresh
    // and the step is left as the worker recorded it (correct).
    current = updateRunState(dir, (fresh) => {
      const applied = applyStepEvent(fresh, {
        type: 'markDied',
        stepId: step.id,
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
  // A retry-clean the death dispense would not have offered must be refused
  // here too, or a hand-crafted reconcile could reset a tree with no restore
  // point and destroy prior steps' work.
  if (action === 'retry-clean' && !canOfferCleanRetry(root, state, step)) {
    return {
      kind: 'error',
      reason: `Cannot apply action 'retry-clean' to step '${
        step.id
      }': ${cleanRetryUnavailableReason(root, state, step)} Use 'adopt' instead.`,
    };
  }
  const applied = applyStepEvent(state, {
    type: 'stepAction',
    stepId: step.id,
    action,
  });
  if (applied.kind === 'error') {
    return applied;
  }
  return { kind: 'ok', state: applied.state, targetStep: step };
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
  state: MigrateRunState,
  step: MigrateStep
): Promise<MigrateCommitLedgerEntry | null> {
  const { name } = splitMigrationId(step.migrationId);
  const absorbedStepIds = uncoveredFailedStepIds(state).filter(
    (id) => id !== step.id
  );
  // Dispensed reconcile commands pin skip-install, so the loop never installs.
  const installer = new ChangedDepInstaller(root, true);
  let result: Awaited<ReturnType<typeof commitMigrationIfRequested>>;
  try {
    result = await commitMigrationIfRequested(
      root,
      { name },
      true,
      state.commitPrefix,
      () => installer.installDepsIfChanged(),
      stepsToPendingMigrations(state, absorbedStepIds)
    );
  } catch (e) {
    // Only the pre-commit dependency install can throw here: the commit
    // attempt itself reports through result.status. Either way the diff is
    // left uncommitted, so record the debt without aborting reconcile; the
    // next dispense still fires.
    warnCommitFailed(name, e);
    return { kind: 'failed', stepIds: [step.id], issueIds: [] };
  }
  if (result.status === 'failed') {
    warnCommitFailed(name);
  }
  return commitResultToLedgerEntry(result, step.id, absorbedStepIds);
}

// --- dispense ---------------------------------------------------------------

function advanceAndDispense(
  root: string,
  dir: string,
  runId: string,
  state: MigrateRunState
): void {
  const current = autoSucceedPlaceholders(dir, state);
  const step = firstActionableStep(current);
  if (!step) {
    completeRun(root, dir, runId, current);
    return;
  }
  switch (step.status) {
    case 'pending':
      dispenseNextStep(root, dir, runId, current, step);
      break;
    case 'dispensed':
      // Re-entry before the worker advanced the step; re-emit its command.
      emitNextStep(root, runId, step);
      break;
    case 'failed':
      emitRetryFailed(root, runId, step);
      break;
    case 'died':
      emitDied(root, runId, current, step);
      break;
    case 'running':
      emitStillRunning(root, runId, step);
      break;
    case 'awaiting-prompt-outcome':
      emitAwaitPrompt(root, dir, runId, step);
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

// peer-compat / install / final-validation are structural placeholders in this
// commit: drive each to success with no child process before the real work.
function autoSucceedPlaceholders(
  dir: string,
  state: MigrateRunState
): MigrateRunState {
  let current = state;
  while (true) {
    const step = firstActionableStep(current);
    if (!step || step.kind === 'migration') return current;
    current = drivePlaceholderToSuccess(dir, step.id);
  }
}

// Drives the placeholder from wherever the fresh on-disk state has it to
// succeeded, in one atomic write. Working from the fresh state under the lock
// makes the drive idempotent under concurrency: when a concurrent init or
// reconcile already advanced or completed the step, the remaining transitions
// no-op instead of failing as duplicates. The transitions are pure state
// churn with no side effects in between, so the batched write loses nothing
// on a crash: the next entry re-drives from wherever the last write stopped.
function drivePlaceholderToSuccess(
  dir: string,
  stepId: string
): MigrateRunState {
  return updateRunState(dir, (fresh) => {
    let current = fresh;
    const at = () => current.steps.find((s) => s.id === stepId);
    if (at().status === 'pending') {
      current = applyEventOrThrow(current, { type: 'dispense', stepId });
    }
    if (at().status === 'dispensed') {
      current = applyEventOrThrow(current, {
        type: 'start',
        stepId,
        pid: process.pid,
        startedAt: nowIso(),
      });
    }
    if (at().status === 'running') {
      current = applyEventOrThrow(current, {
        type: 'succeed',
        stepId,
        finishedAt: nowIso(),
      });
    }
    if (at().status !== 'succeeded') {
      throw new Error(
        `Orchestrator could not auto-complete the ${at().kind} step '${stepId}'.`
      );
    }
    return current === fresh ? null : current;
  });
}

function dispenseNextStep(
  root: string,
  dir: string,
  runId: string,
  state: MigrateRunState,
  step: MigrateStep
): void {
  // Read the pre-migration ref (a git read) before the lock; the dispense
  // transition and the ref set then apply to the fresh state in one write.
  const head = getLatestCommitSha(root);
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
    return head ? setGitRefBefore(dispensed, step.id, head) : dispensed;
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
  emit(runId, step, 'next-step', {
    command: workerCommand(root, migrationId, runId),
    then: reconcileCommand(root, runId),
    instructions: `Apply migration ${migrationId} by running the command below, then run the "then" command to record the outcome and get the next step.`,
  });
}

function emitRetryFailed(root: string, runId: string, step: MigrateStep): void {
  const migrationId = step.migrationId ?? step.id;
  const summary = step.outcome?.summary;
  emit(runId, step, 'retry-failed', {
    then: reconcileCommand(root, runId, 'retry'),
    instructions: [
      `Migration ${migrationId} failed${summary ? `: ${summary}` : ''}.`,
      `Decide how to proceed and re-run reconcile with one of:`,
      `  retry: ${reconcileCommand(root, runId, 'retry')}`,
      `  skip:  ${reconcileCommand(root, runId, 'skip')}`,
    ].join('\n'),
  });
}

// A clean retry resets the tree to the dead step's captured pre-migration ref.
// That is only safe when every prior diff is already committed: without
// per-migration commits the ref is the run's starting commit (the reset would
// wipe all prior steps' uncommitted work); a failed init checkpoint or a
// pending step commit means the ref predates diffs the reset would also
// destroy; without a captured ref there is nothing to reset to; and a landed
// commit of this step's own that the ref does not contain would be discarded
// by the reset (the death window between the worker's ledger write and its
// succeed write).
function canOfferCleanRetry(
  root: string,
  state: MigrateRunState,
  step: MigrateStep
): boolean {
  return (
    state.createCommits &&
    !state.checkpointFailed &&
    !hasPendingCommitDebt(state) &&
    !!step.gitRefBefore &&
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

// Explains why retry-clean is withheld for a died step; feeds both the death
// dispense and a rejected --step-action=retry-clean.
function cleanRetryUnavailableReason(
  root: string,
  state: MigrateRunState,
  step: MigrateStep
): string {
  const endangered = endangeredLandedEntry(root, state, step);
  if (!endangered) {
    return `resetting the tree could discard uncommitted work that no restore point accounts for.`;
  }
  return endangered.sha
    ? `this migration's changes already landed in commit ${endangered.sha}, which a reset would discard.`
    : `this migration's changes already landed in a commit, which a reset would discard.`;
}

function emitDied(
  root: string,
  runId: string,
  state: MigrateRunState,
  step: MigrateStep
): void {
  const migrationId = step.migrationId ?? step.id;
  const ref = step.gitRefBefore;
  const head = getLatestCommitSha(root);
  const tree = dirtyTreeSummary(root);
  const cleanRetry = canOfferCleanRetry(root, state, step);
  const lines = [
    `The worker for ${migrationId} died; its process is gone.`,
    `  started from: ${ref ?? '(unknown)'}`,
    `  current HEAD: ${head ?? '(unknown)'}`,
    `  working tree: ${tree ? `\n${tree}` : '(clean)'}`,
    ``,
  ];
  const adoptLine = `  adopt: keep the current working-tree state as this migration's result, then run: ${reconcileCommand(
    root,
    runId,
    'adopt'
  )}`;
  if (cleanRetry) {
    lines.push(
      `Choose exactly one:`,
      `  retry-clean: restore the tree to ${
        ref ?? 'the pre-migration ref'
      } first (e.g. \`git reset --hard ${
        ref ?? '<ref>'
      } && git clean -fd -e .nx/migrate-runs\`, keeping the run state out of the clean), then run: ${reconcileCommand(
        root,
        runId,
        'retry-clean'
      )}`,
      adoptLine
    );
  } else {
    lines.push(
      `A clean retry is unavailable: ${cleanRetryUnavailableReason(
        root,
        state,
        step
      )}`,
      adoptLine
    );
  }
  emit(runId, step, 'died', {
    then: reconcileCommand(root, runId, cleanRetry ? 'retry-clean' : 'adopt'),
    instructions: lines.join('\n'),
  });
}

function emitStillRunning(
  root: string,
  runId: string,
  step: MigrateStep
): void {
  const migrationId = step.migrationId ?? step.id;
  const ageMs = step.startedAt ? Date.now() - Date.parse(step.startedAt) : 0;
  const lines = [
    `The worker for ${migrationId} (pid ${step.pid}) is still running. Wait for it to finish, then run the "then" command.`,
  ];
  if (ageMs >= HANG_THRESHOLD_MS) {
    lines.push(
      `It has been running for ${Math.floor(
        ageMs / 60000
      )} minutes and may be hung. Verify pid ${step.pid}; either keep waiting, or kill it so the next reconcile can classify it as died.`
    );
  }
  emit(runId, step, 'still-running', {
    then: reconcileCommand(root, runId),
    instructions: lines.join('\n'),
  });
}

function emitAwaitPrompt(
  root: string,
  dir: string,
  runId: string,
  step: MigrateStep
): void {
  const migrationId = step.migrationId;
  const { package: pkg, name } = splitMigrationId(migrationId);
  const handoffPath = stepHandoffPath(dir, { package: pkg, name });
  const lines = [
    `Migration ${migrationId} is a prompt-based migration awaiting your outcome.`,
    `Apply the prompt (see the worker's earlier <nx_migrate_prompt> block), then write the handoff file and run the "then" command.`,
    `Handoff file: ${handoffPath}`,
    `Handoff JSON: { "status": "success" | "failed", "summary": "<what you did>" }. To mark the prompt not applicable, use "status": "success" with "outcome": "skipped".`,
  ];
  // A handoff that exists but can't be read/parsed/validated is a rejection,
  // not a still-awaited outcome. Naming why stops the run from re-emitting the
  // same await forever while the agent leaves the bad file in place.
  const rejection = describeRejectedHandoff(handoffPath);
  if (rejection.length > 0) {
    lines.push('', ...rejection);
  }
  emit(runId, step, 'await-prompt', {
    then: reconcileCommand(root, runId),
    instructions: lines.join('\n'),
  });
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
  const followUp = 'Rewrite the handoff file, then run the "then" command.';
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
  }
}

function emitError(root: string, runId: string, reason: string): void {
  output.warn({
    title: 'The requested --step-action could not be applied.',
    bodyLines: [reason],
  });
  writeBlock(
    runId,
    '-',
    'error',
    jsonPayload({ then: reconcileCommand(root, runId), instructions: reason })
  );
  reportMigrateOrchestratorDispense({
    action: 'error',
    stepKind: 'none',
    attempt: 0,
  });
}

function completeRun(
  root: string,
  dir: string,
  runId: string,
  state: MigrateRunState
): void {
  let current = state;
  const migrationSteps = current.steps.filter((s) => s.kind === 'migration');
  const completed = migrationSteps.filter(
    (s) => s.status === 'succeeded'
  ).length;
  const skipped = migrationSteps.filter((s) => s.status === 'skipped').length;
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
    output.warn({ title: debtLine });
  }
  const instructions = [
    `Migrate run ${runId} is complete.`,
    `  applied: ${completed}`,
    `  skipped: ${skipped}`,
    ...(commitDebt ? [debtLine] : []),
  ].join('\n');
  output.log({
    title: 'nx migrate: complete',
    bodyLines: instructions.split('\n'),
  });
  writeBlock(runId, '-', 'complete', jsonPayload({ instructions }));
}

// --- output -----------------------------------------------------------------

interface DispensePayload {
  command?: string;
  then?: string;
  instructions?: string;
}

function emit(
  runId: string,
  step: MigrateStep,
  action: string,
  payload: DispensePayload
): void {
  output.log({
    title: `nx migrate: ${action}`,
    bodyLines: payload.instructions ? payload.instructions.split('\n') : [],
  });
  writeBlock(runId, step.id, action, jsonPayload(payload));
  reportMigrateOrchestratorDispense({
    action,
    stepKind: step.kind,
    attempt: step.attempt,
  });
}

// Mirrors print-dropped-agent-context.ts: a raw `<` in a payload value could
// forge the closing tag, so escape it to the JSON unicode escape (leaving valid
// JSON) and frame the block with a bare newline pair.
function jsonPayload(payload: object): string {
  return JSON.stringify(payload, null, 2).replace(/</g, '\\u003c');
}

function writeBlock(
  runId: string,
  stepId: string,
  action: string,
  json: string
): void {
  const block = [
    `<nx_migrate_step run-id="${escapeXmlAttr(runId)}" step="${escapeXmlAttr(
      stepId
    )}" action="${escapeXmlAttr(action)}">`,
    json,
    `</nx_migrate_step>`,
  ].join('\n');
  process.stdout.write(`\n${block}\n\n`);
}

// Raw argv is forwarded verbatim across the wrapper hops, so every flag is a
// single `--flag=value` token. Interpolated values are validated shell-safe at
// init (migration ids) and reconcile entry (run id).
function workerCommand(
  root: string,
  migrationId: string,
  runId: string
): string {
  return `NX_MIGRATE_USE_LOCAL=true NX_MIGRATE_SKIP_INSTALL=true ${pmExecPrefix(
    root
  )} nx migrate --run-migration=${migrationId} --run-id=${runId}`;
}

// A bare `--run-id` parse requires the orchestrator gate (migrate.ts), so the
// dispensed reconcile carries it rather than relying on a session-wide export.
// The worker command keeps `--run-migration`, whose parse needs no gate.
function reconcileCommand(
  root: string,
  runId: string,
  action?: StepAction
): string {
  const base = `NX_MIGRATE_ORCHESTRATOR=true NX_MIGRATE_USE_LOCAL=true NX_MIGRATE_SKIP_INSTALL=true ${pmExecPrefix(
    root
  )} nx migrate --run-id=${runId}`;
  return action ? `${base} --step-action=${action}` : base;
}

// --- helpers ----------------------------------------------------------------

function appendCommit(
  state: MigrateRunState,
  entry: MigrateCommitLedgerEntry
): MigrateRunState {
  return { ...state, commits: [...state.commits, entry] };
}

function setGitRefBefore(
  state: MigrateRunState,
  stepId: string,
  ref: string
): MigrateRunState {
  return {
    ...state,
    steps: state.steps.map((s) =>
      s.id === stepId ? { ...s, gitRefBefore: ref } : s
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

function removeHandoff(dir: string, migrationId: string): void {
  rmSync(stepHandoffPath(dir, splitMigrationId(migrationId)), { force: true });
}

function dirtyTreeSummary(root: string): string {
  try {
    return execSync('git status --porcelain', {
      encoding: 'utf8',
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    }).trim();
  } catch {
    return '';
  }
}
