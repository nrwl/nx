import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import type { FileChange } from '../../../generators/tree';
import { getLatestCommitSha, isGitRepository } from '../../../utils/git-utils';
import { readJsonFile } from '../../../utils/fileutils';
import { getNxRequirePaths } from '../../../utils/installation-directory';
import { readModulePackageJson } from '../../../utils/package-json';
import { printDroppedAgentContextForOuterAgent } from '../agentic/print-dropped-agent-context';
import {
  dropUnsupportedAgent,
  resolveAgentic,
  type AgenticArg,
} from '../agentic/select';
import {
  MIGRATE_RUNS_RELATIVE_DIR,
  type DetectedInstalledAgent,
  type ResolvedAgentic,
} from '../agentic/types';
import { DEFAULT_MIGRATION_COMMIT_PREFIX } from '../command-object';
import {
  ChangedDepInstaller,
  formatSingleMigrationRerunCommand,
  logSkippedPostMigrationInstall,
  readMigrationCollection,
  resolveDocumentationFileToWorkspacePath,
  runNxOrAngularMigration,
  type ResolvedMigrationCollection,
} from '../execute-migration';
import {
  reportMigrateRunError,
  reportMigrateSingleMigrationAbandoned,
  reportMigrateSingleMigrationComplete,
  reportMigrateSingleMigrationInvocation,
} from '../migrate-analytics';
import {
  commitCheckpointBeforeMigrations,
  commitMigrationIfRequested,
  confirmMigrationCommitsOnDefaultBranch,
  resolveCreateCommits,
} from '../migrate-commits';
import { logWaivedAgenticStep } from '../migrate-output';
import {
  isHybridMigration,
  isPromptOnlyMigration,
  type PlannedMigration,
} from '../migration-shape';
import { canPrompt } from '../safe-prompt';
import {
  hasRunState,
  migrationIdProblems,
  readRunState,
  runDir,
  type MigrateCommitLedgerEntry,
  type MigrateRunState,
  type MigrateStep,
  type MigrateStepAwaitingKind,
  type MigrateStepOutcome,
} from './run-state';
import { RUN_ID_SAFE } from './run-id';
import {
  appendCommit,
  applyStepEvent,
  commitResultToLedgerEntry,
  latestRound,
  markInstallFailed,
  stepsToPendingMigrations,
  uncoveredFailedStepIds,
  unresolvedFailureDetail,
  type StepEvent,
} from './state-machine';
import {
  holdRunActivity,
  updateRunState,
  withRunCreationLock,
} from './state-lock';
import {
  commitFailureRecovery,
  installDepsChangedSinceDispense,
  nowIso,
  pmExecPrefix,
  recordInstallLanded,
  summarizeError,
  warnCommitFailed,
} from './util';
import {
  BrokerStaleRequestError,
  commitStepTree,
  installStepTree,
  TreeBusyError,
  type BrokeredCommit,
  type TreeScope,
} from './broker';
import { singleLine } from '../text';
import {
  emitPromptBlock,
  errorToAgent,
  logToAgent,
  warnToAgent,
} from './agent-output';
import {
  agentWorkPayloadPath,
  latestStoredAgentWorkPayload,
  persistAgentWorkPayload,
} from './agent-work-payload';
import { attachIssueIdsToCommitEntry } from './issues';
import {
  completionWarnings,
  dispenseSingleMigrationStep,
  lastCoveringLandedEntry,
  prepareSingleMigrationRun,
  removeSingleMigrationRun,
  runOrchestratorInit,
} from './orchestrator';

// Runs exactly one migration, either standalone or recorded into an existing
// orchestrated run via `--run-id`. Standalone runs keep no durable run state,
// except with an agent: that run records the migration as a one-step run and
// removes the record when it ends.

export interface RunSingleMigrationWorkerInput {
  root: string;
  runMigration: string;
  runId?: string;
  /** The raw `--agentic` value; resolved here against the environment. */
  agentic: AgenticArg;
  validate: boolean | undefined;
  /** The requested value; the effective value is resolved here against the agentic kind. */
  createCommits: boolean | undefined;
  commitPrefix: string;
  interactive: boolean | undefined;
  skipInstall: boolean;
  isVerbose: boolean;
}

export async function runSingleMigrationWorker(
  input: RunSingleMigrationWorkerInput
): Promise<number | undefined> {
  const {
    root,
    runMigration,
    runId,
    commitPrefix,
    interactive,
    skipInstall,
    isVerbose,
  } = input;

  // The worker is a second CLI entry point: the run id reaches runDir() (where
  // join resolves '..'), so validate it up front exactly as the orchestrator
  // does before it trusts a run id.
  if (runId !== undefined && !RUN_ID_SAFE.test(runId)) {
    throw new Error(`Invalid run id '${runId}'.`);
  }

  const { migrations, source, singleMigration } = readMigrationsSource(
    root,
    runId
  );
  const migration = resolveMigration(migrations, runMigration, source);

  // A retry in the agent session of a `--run-migration` run belongs to the
  // invocation that started that run, which already reported.
  if (!singleMigration) {
    reportMigrateSingleMigrationInvocation({
      migrationType: isPromptOnlyMigration(migration)
        ? 'prompt'
        : isHybridMigration(migration)
          ? 'hybrid'
          : 'generator',
      orchestrated: !!runId,
    });
  }

  if (runId) {
    // A recorded run takes its commit config from run.json and is driven by
    // the outer agent, so the standalone resolution below doesn't apply. That
    // includes the default-branch confirmation: the run decided once, at init,
    // whether to commit, and asking again would re-prompt on every step.
    await runRecorded(root, runId, migration, skipInstall, isVerbose, 'worker');
    return;
  }

  // Before the agent selection, which may prompt.
  prepareSingleMigrationRun(root);

  let agentic: ResolvedAgentic;
  try {
    agentic = await resolveAgentic({
      agentic: input.agentic,
      migrations: [migration],
      interactive,
    });
  } catch (e) {
    reportMigrateRunError({ code: 'agentic', error: e });
    throw e;
  }
  // Resolved before the commit policy, which defaults on only for an agent.
  agentic = dropUnsupportedAgent(agentic, migrationIdProblems([migration]));

  const resolved = resolveCreateCommits({
    createCommits: input.createCommits,
    mode: agentic.kind,
    isGitRepo: isGitRepository(root),
    commitPrefixIsCustom: commitPrefix !== DEFAULT_MIGRATION_COMMIT_PREFIX,
  });
  if (resolved.error) {
    throw new Error(resolved.error);
  }
  if (resolved.warning) {
    warnToAgent({ title: resolved.warning });
  }
  const createCommits = resolved.effective;
  const confirmStart = async () =>
    !createCommits ||
    !canPrompt(interactive) ||
    (await confirmMigrationCommitsOnDefaultBranch(
      root,
      'running the migration'
    ));

  if (agentic.kind === 'enabled') {
    return runAgenticSingleMigration({
      root,
      migration,
      agent: agentic.selectedAgent,
      createCommits,
      commitPrefix,
      skipInstall,
      isVerbose,
      validate: input.validate,
      confirmStart,
    });
  }

  if (!(await confirmStart())) {
    return;
  }

  await runStandalone(root, migration, {
    agenticKind: agentic.kind,
    // Inside an agent, --agentic=false drops the review; prompts still go out.
    validate: input.agentic === false ? false : input.validate,
    createCommits,
    commitPrefix,
    skipInstall,
    isVerbose,
  });
}

function readMigrationsSource(
  root: string,
  runId: string | undefined
): {
  migrations: PlannedMigration[];
  source: string;
  singleMigration?: boolean;
} {
  if (runId) {
    const dir = runDir(root, runId);
    // A missing run.json would surface a raw ENOENT from readRunState; report
    // it the way the orchestrator does instead, with no remediation: starting
    // a run is a gated entry point of its own.
    if (!hasRunState(dir)) {
      throw new Error(
        `No migrate run '${runId}' was found under ${MIGRATE_RUNS_RELATIVE_DIR}.`
      );
    }
    // Before the state and plan reads: a concurrent start-fresh must not
    // delete the run while this worker resolves its migration.
    holdRunActivity(root, runId);
    // Version refusal (NewerRunStateFormatError) propagates.
    const state = readRunState(dir);
    const round = latestRound(state);
    if (!round) {
      throw new Error(
        `The migrate run '${runId}' has no recorded plan, so there is no migration to run.`
      );
    }
    // Safe to join and to name in the error below only because the read
    // refuses any planSnapshot that is not a bare `plan-<round>.json`.
    const planPath = join(dir, round.planSnapshot);
    if (!existsSync(planPath)) {
      throw new Error(
        `The plan snapshot '${round.planSnapshot}' for migrate run '${runId}' doesn't exist, can't run the migration.`
      );
    }
    return {
      migrations: readPlanMigrations(planPath),
      source: round.planSnapshot,
      singleMigration: state.singleMigration === true,
    };
  }

  const migrationsPath = join(root, 'migrations.json');
  if (!existsSync(migrationsPath)) {
    throw new Error(
      `File 'migrations.json' doesn't exist, can't run the migration. Run \`${pmExecPrefix(
        root
      )} nx migrate\` to generate it first.`
    );
  }
  return {
    migrations: readPlanMigrations(migrationsPath),
    source: 'migrations.json',
  };
}

function readPlanMigrations(path: string): PlannedMigration[] {
  return (
    readJsonFile<{ migrations?: PlannedMigration[] }>(path).migrations ?? []
  );
}

function resolveMigration(
  migrations: PlannedMigration[],
  id: string,
  source: string
): PlannedMigration {
  // Split on the first ':' only, so a name that itself contains one survives.
  const colon = id.indexOf(':');
  const matches =
    colon === -1
      ? migrations.filter((m) => m.name === id)
      : migrations.filter(
          (m) =>
            m.package === id.slice(0, colon) && m.name === id.slice(colon + 1)
        );

  if (matches.length === 0) {
    throw new Error(`No migration matching '${id}' was found in ${source}.`);
  }
  if (matches.length > 1) {
    throw new Error(
      [
        `More than one migration matches '${id}' in ${source}. Re-run with the full '<package>:<name>' id:`,
        ...matches.map((m) => `  - ${m.package}:${m.name}`),
      ].join('\n')
    );
  }
  return matches[0];
}

interface StandaloneRunOptions {
  agenticKind: Exclude<ResolvedAgentic['kind'], 'enabled'>;
  validate: boolean | undefined;
  createCommits: boolean;
  commitPrefix: string;
  skipInstall: boolean;
  isVerbose: boolean;
}

async function runStandalone(
  root: string,
  migration: PlannedMigration,
  opts: StandaloneRunOptions
): Promise<void> {
  const { agenticKind, createCommits, commitPrefix, skipInstall, isVerbose } =
    opts;

  if (isPromptOnlyMigration(migration)) {
    // No agent to apply the prompt, so nothing runs: no checkpoint, no
    // commit.
    emitOrPrintPrompt(root, migration, agenticKind);
    return;
  }

  // Checkpoint pre-existing working-tree state first, or the migration
  // commit's `git add -A` folds it in.
  if (createCommits) {
    commitCheckpointBeforeMigrations(root, commitPrefix);
  }

  const installer = new ChangedDepInstaller(
    root,
    skipInstall,
    formatSingleMigrationRerunCommand(`${migration.package}:${migration.name}`)
  );

  // The outer agent validates a generator-only migration's changes, as the
  // validation pass of a recorded step would.
  const shouldValidate =
    agenticKind === 'inside-agent' && opts.validate !== false;
  const resolvedCollection = readMigrationCollection(migration.package, root);
  const { changes, nextSteps, agentContext, skipAgentic, logs, madeChanges } =
    await runNxOrAngularMigration(
      root,
      migration,
      isVerbose,
      isHybridMigration(migration) || shouldValidate,
      resolvedCollection
    );

  const work = owedAgentWork(migration, shouldValidate, changes, skipAgentic);
  logWaiverOrForwardAgentContext(migration, work, agentContext, agenticKind);

  // A no-op migration must not build a commit whose `git add -A` absorbs
  // unrelated pending diffs under its name. The commit path installs deps
  // itself, so the else branch does it here instead.
  if (createCommits && madeChanges) {
    await commitMigrationIfRequested(
      root,
      migration,
      createCommits,
      commitPrefix,
      () => installer.installDepsIfChanged(),
      [],
      'manual'
    );
  } else {
    await installer.installDepsIfChanged();
  }

  if (installer.skippedInstall) {
    logSkippedPostMigrationInstall(root);
  }

  printNextSteps(migration, nextSteps);

  if (work.validationOwed) {
    emitValidationBlock(
      root,
      migration,
      { logs, changes, agentContext },
      { resolvedCollection }
    );
  }

  // A waived prompt is not deferred, so it gets no hand-off to an outer agent
  // and no "apply this manually" block for the user either.
  if (work.promptOwed) {
    emitOrPrintPrompt(root, migration, agenticKind, {
      impl: {
        logs,
        changes,
        agentContext,
      },
      resolvedCollection,
    });
  }
}

interface AgenticSingleMigrationInput {
  root: string;
  migration: PlannedMigration;
  agent: DetectedInstalledAgent;
  createCommits: boolean;
  commitPrefix: string;
  skipInstall: boolean;
  isVerbose: boolean;
  validate: boolean | undefined;
  confirmStart: () => Promise<boolean>;
}

// Records the migration as a one-step run and runs its generator part here, as
// a dispensed worker would. The agent starts only for work the step hands
// back, and its first "next" gets that work.
async function runAgenticSingleMigration(
  input: AgenticSingleMigrationInput
): Promise<number | undefined> {
  const { root, migration, agent, createCommits, skipInstall } = input;
  const migrationId = `${migration.package}:${migration.name}`;
  const ready = await runOrchestratorInit({
    root,
    migrationsJson: { migrations: [migration] },
    createCommits,
    commitPrefix: input.commitPrefix,
    skipInstall,
    installedNxVersion: readModulePackageJson('nx', getNxRequirePaths(root))
      .packageJson.version,
    validate: input.validate,
    finalValidation: false,
    emitAgentInstructions: false,
    singleMigration: true,
    confirmStart: input.confirmStart,
  });
  switch (ready.kind) {
    case 'refused':
      return;
    case 'existing-run':
      throw new Error(
        `A --run-migration run never reports an active run, but init reported '${ready.runId}'.`
      );
    case 'ready':
      break;
    default: {
      const unhandled: never = ready;
      throw new Error(`Unhandled init result: ${JSON.stringify(unhandled)}`);
    }
  }

  const { runId } = ready;
  try {
    dispenseSingleMigrationStep(root, runId);
    const parked = await runRecorded(
      root,
      runId,
      migration,
      skipInstall,
      input.isVerbose,
      'single-run-parent'
    );
    if (!parked) {
      logToAgent({ title: `Migration ${migrationId} is complete.` });
      warnAboutLeftovers(root, runId, readRunState(runDir(root, runId)));
      reportMigrateSingleMigrationComplete({});
      return;
    }

    logToAgent({
      title: `Starting ${agent.displayName} for migration ${migrationId}.`,
    });
    const { driveMasterSession } =
      require('../agentic/master/run-master-session') as typeof import('../agentic/master/run-master-session');
    const rerunHint = `Migration ${migrationId} did not finish. Re-run the same command to run it again.`;
    const state = await driveMasterSession({
      agent,
      ready,
      policy: { createCommits, skipInstall },
      migration,
      notStartedHint: rerunHint,
    });
    if (!state) return 1;
    switch (state.status) {
      case 'active':
        reportMigrateSingleMigrationAbandoned({ agentUsed: agent.id });
        warnToAgent({ title: rerunHint });
        return 1;
      case 'completed': {
        const unresolved = logSingleMigrationOutcome(state, migrationId);
        warnAboutLeftovers(root, runId, state);
        reportMigrateSingleMigrationComplete({ agentUsed: agent.id });
        return unresolved ? 1 : undefined;
      }
      default: {
        const unhandled: never = state.status;
        throw new Error(`Unhandled migrate run status: ${unhandled}`);
      }
    }
  } finally {
    withRunCreationLock(root, () => removeSingleMigrationRun(root, runId));
  }
}

function warnAboutLeftovers(
  root: string,
  runId: string,
  state: MigrateRunState
): void {
  for (const lines of completionWarnings(root, runId, state)) {
    warnToAgent({ title: lines[0], bodyLines: lines.slice(1) });
  }
}

// The record is removed next, so the closing output carries the settling
// summary and commit. Returns whether the migration was left unresolved.
function logSingleMigrationOutcome(
  state: MigrateRunState,
  migrationId: string
): boolean {
  const [step] = state.steps;
  const sha = lastCoveringLandedEntry(state, step)?.sha;
  const outcomeLines = (summary: string | undefined) => [
    ...(summary?.trim() ? [summary] : []),
    ...(sha ? [`Commit: ${sha}`] : []),
  ];
  switch (step.status) {
    case 'succeeded':
      logToAgent({
        title: `Migration ${migrationId} is complete.`,
        // Adopt writes outcome.summary; promptOutcome still holds the failed
        // handoff.
        bodyLines: outcomeLines(
          step.adopted
            ? step.outcome?.summary
            : (step.promptOutcome?.summary ?? step.outcome?.summary)
        ),
      });
      return false;
    case 'skipped':
      logToAgent({
        title: `Migration ${migrationId} was skipped.`,
        // After a --step-action skip, promptOutcome is the failed handoff's.
        bodyLines: outcomeLines(
          step.promptOutcome?.status === 'skipped'
            ? step.promptOutcome.summary
            : undefined
        ),
      });
      return false;
    case 'unresolved':
      errorToAgent({
        title: `Migration ${migrationId} is unresolved.`,
        bodyLines: outcomeLines(unresolvedFailureDetail(step)),
      });
      return true;
    case 'pending':
    case 'dispensed':
    case 'running':
    case 'awaiting-prompt-outcome':
    case 'failed':
    case 'died':
      throw new Error(
        `Migrate run completed with migration ${migrationId} in status '${step.status}'.`
      );
    default: {
      const unhandled: never = step.status;
      throw new Error(`Unhandled step status: ${unhandled}`);
    }
  }
}

// 'worker': a dispensed command, whose output the agent driving the run reads.
// 'single-run-parent': the first attempt of a `--run-migration` run's step, run
// by the process that starts the agent only afterwards. Returns whether the
// step was parked for an agent.
async function runRecorded(
  root: string,
  runId: string,
  migration: PlannedMigration,
  skipInstall: boolean,
  isVerbose: boolean,
  caller: 'worker' | 'single-run-parent'
): Promise<boolean> {
  const dir = runDir(root, runId);
  // Version refusal (NewerRunStateFormatError) propagates.
  let state = readRunState(dir);

  // A worker never resolves the agentic flow: the outer agent drives the run,
  // and the dispensed command is part of the orchestrated protocol whoever
  // re-runs it. Gating the block on ambient agent detection would park the
  // step awaiting an outcome whose payload was never emitted. The parent of a
  // `--run-migration` run stores the work it hands back without printing it:
  // its agent gets that work from the first "next".
  const emitsHandBack = caller === 'worker';
  const agenticKind: ResolvedAgentic['kind'] = emitsHandBack
    ? 'inside-agent'
    : 'enabled';

  const migrationId = `${migration.package}:${migration.name}`;
  // The parent's run is removed when it ends, so its hint is the command the
  // user ran.
  const rerunCommand = emitsHandBack
    ? `${formatSingleMigrationRerunCommand(migrationId)} --run-id=${runId}`
    : formatSingleMigrationRerunCommand(migrationId);
  // The plan was read from the latest round's snapshot, so only that round's
  // step may match; a same-id step from an older round must not.
  const latest = latestRound(state);
  const step = state.steps.find(
    (s) =>
      s.kind === 'migration' &&
      s.migrationId === migrationId &&
      s.roundIndex === latest?.index
  );
  if (!step) {
    throw new Error(
      `The migrate run '${runId}' has no step for migration '${migrationId}'.`
    );
  }

  // Validated against the fresh disk state: a second worker racing the same
  // dispensed step reads 'running' here and aborts before the engine runs.
  state = transition(dir, {
    type: 'start',
    stepId: step.id,
    pid: process.pid,
    startedAt: nowIso(),
  });

  // A prior attempt's generator half already ran, so this attempt must not
  // reapply it against a tree that already holds its changes. Read from the
  // state the start transition returned, not the entry snapshot: a delayed
  // invocation may have claimed a later attempt whose flag `step` predates.
  const startedStep = state.steps.find((s) => s.id === step.id);
  const generatorAlreadyCompleted = startedStep.generatorCompleted === true;
  // Dispensed worker commands never carry the user's flags, so the run records
  // its install policy. An explicit --skip-install here applies only to the
  // installs this process runs itself; a parent session answers from its own.
  const effectiveSkipInstall = state.skipInstall === true || skipInstall;
  // The run records the resolved validation policy at init; absent (a state
  // predating the field) falls back to the same default init applies.
  const shouldValidate = state.validate !== false;
  // The tree reservation an in-process install or commit takes is held until
  // the transition that records this attempt's outcome is written.
  const scope: TreeScope = {};
  // Called before a retry hands the step's work back: the prompt or validation
  // may need the dependencies the earlier attempt's generator added.
  const reinstallFromBaseline = () =>
    installStepTree(
      dir,
      startedStep,
      'install',
      () =>
        recordingInstallFailure(dir, step.id, () =>
          installDepsChangedSinceDispense(
            root,
            dir,
            startedStep,
            effectiveSkipInstall,
            rerunCommand
          )
        ),
      scope
    );

  let outcome: MigrateStepOutcome | undefined;
  let awaitingKind: MigrateStepAwaitingKind | undefined;
  const payloadPath = agentWorkPayloadPath(dir, step.id, startedStep.attempt);
  try {
    try {
      if (isPromptOnlyMigration(migration)) {
        const payload = promptPayload(root, migration, undefined, undefined);
        persistAgentWorkPayload(payloadPath, payload);
        if (emitsHandBack) emitPromptForOuterAgent(migrationId, payload, true);
        awaitingKind = 'migration-prompt';
      } else if (
        generatorAlreadyCompleted &&
        startedStep.agenticWaived !== true &&
        isHybridMigration(migration)
      ) {
        await reinstallFromBaseline();
        const carried = latestStoredAgentWorkPayload(
          dir,
          step.id,
          startedStep.attempt,
          startedStep.generatorCompletedAtAttempt,
          {
            migrationId,
            kind: 'migration-prompt',
            promptPath: migration.prompt,
          }
        );
        if (carried) {
          reemitCarriedAgentWork(
            migrationId,
            'migration-prompt',
            payloadPath,
            carried
          );
        } else {
          emitOrPrintPrompt(root, migration, agenticKind, {
            persistPath: payloadPath,
          });
        }
        awaitingKind = 'migration-prompt';
      } else if (
        generatorAlreadyCompleted &&
        startedStep.validationOwed === true
      ) {
        // The flag is the only record that these changes still owe a validation
        // pass; the decision needed the generator result, which is gone with the
        // attempt that made it. The commit stays with the fold.
        await reinstallFromBaseline();
        const carried = latestStoredAgentWorkPayload(
          dir,
          step.id,
          startedStep.attempt,
          startedStep.generatorCompletedAtAttempt,
          { migrationId, kind: 'generator-validation' }
        );
        if (carried) {
          reemitCarriedAgentWork(
            migrationId,
            'generator-validation',
            payloadPath,
            carried
          );
        } else {
          emitValidationBlock(root, migration, undefined, {
            persistPath: payloadPath,
          });
        }
        awaitingKind = 'generator-validation';
      } else if (generatorAlreadyCompleted) {
        state = await finishCompletedGenerator(
          dir,
          root,
          state,
          startedStep,
          migration,
          effectiveSkipInstall,
          rerunCommand,
          scope
        );
        outcome = buildOutcome(
          [],
          [],
          'The generator ran in an earlier attempt; this attempt completed its install and commit.',
          root
        );
      } else {
        const installer = new ChangedDepInstaller(
          root,
          effectiveSkipInstall,
          rerunCommand
        );
        // Read once; the run and the hybrid documentation resolution share it.
        const resolvedCollection = readMigrationCollection(
          migration.package,
          root
        );
        const {
          changes,
          nextSteps,
          agentContext,
          skipAgentic,
          logs,
          madeChanges,
        } = await runNxOrAngularMigration(
          root,
          migration,
          isVerbose,
          // Captured whenever an agent step may consume it: a hybrid's prompt
          // payload, or the validation pass over the generator's changes.
          isHybridMigration(migration) || shouldValidate,
          resolvedCollection
        );

        const work = owedAgentWork(
          migration,
          shouldValidate,
          changes,
          skipAgentic
        );
        const { validationOwed, promptOwed } = work;

        // Recorded before the commit is attempted: from here on the changes are
        // in the tree, so a failed install or commit must leave a retry with
        // only those left to do rather than running the generator again.
        state = transition(dir, {
          type: 'markGeneratorCompleted',
          stepId: step.id,
          agenticWaived: work.waived,
          validationOwed,
          madeChanges,
        });

        logWaiverOrForwardAgentContext(
          migration,
          work,
          agentContext,
          agenticKind
        );

        // Stored before the install: a failed install fails the attempt, and
        // the retry re-hands this payload instead of a context-free one.
        const impl = { logs, changes, agentContext };
        const owed = validationOwed
          ? validationPayload(root, migration, impl, resolvedCollection)
          : promptOwed
            ? promptPayload(root, migration, impl, resolvedCollection)
            : undefined;
        if (owed) {
          persistAgentWorkPayload(payloadPath, owed);
        }

        const install = () =>
          recordingInstallFailure(dir, step.id, () =>
            installer.installDepsIfChanged()
          );

        // A no-op step's commit would absorb prior pending diffs under its name;
        // a step handing work back defers its commit to the fold, so the
        // migration still lands as one commit. The install runs either way: the
        // agent may run tasks that need what the generator added.
        if (
          state.createCommits &&
          madeChanges &&
          !validationOwed &&
          !promptOwed
        ) {
          state = await commitStepChanges(
            dir,
            root,
            state,
            startedStep,
            migration,
            install,
            scope
          );
        } else {
          await installStepTree(dir, startedStep, 'install', install, scope);
        }

        if (installer.skippedInstall) {
          logSkippedPostMigrationInstall(root);
        } else if (installer.installed) {
          recordInstallLanded(root, dir, step.id);
        }

        printNextSteps(migration, nextSteps);

        if (validationOwed) {
          if (emitsHandBack) emitValidationPayload(migrationId, owed, true);
          awaitingKind = 'generator-validation';
        } else if (promptOwed) {
          if (emitsHandBack) emitPromptForOuterAgent(migrationId, owed, true);
          awaitingKind = 'migration-prompt';
        } else {
          outcome = buildOutcome(
            changes,
            nextSteps,
            migration.description,
            root
          );
        }
      }
    } catch (e) {
      // Another attempt owns the step, and `fail` is not attempt-bound.
      if (e instanceof BrokerStaleRequestError) throw e;
      // The failed-step dispense surfaces this so the agent can decide
      // retry-vs-skip; carry the error's first line, not a full stack.
      transition(dir, {
        type: 'fail',
        stepId: step.id,
        finishedAt: nowIso(),
        outcome: { summary: summarizeError(e) },
      });
      throw e;
    }

    // Handed-back work is applied by a separate actor, so parking exits
    // successfully rather than failing the step.
    if (awaitingKind !== undefined) {
      transition(dir, {
        type: 'awaitPromptOutcome',
        stepId: step.id,
        finishedAt: nowIso(),
        awaitingKind,
      });
      return true;
    }

    transition(dir, {
      type: 'succeed',
      stepId: step.id,
      finishedAt: nowIso(),
      ...(outcome ? { outcome } : {}),
    });
    return false;
  } finally {
    scope.lease?.release();
  }
}

// Applies a step event to the freshest on-disk state under the lock, writes it,
// and returns it. Reading fresh is what makes a racing worker's 'start' see the
// step already 'running' and abort. An illegal transition (e.g. a step that was
// never dispensed) fails with the state machine's own reason.
function transition(dir: string, event: StepEvent): MigrateRunState {
  return updateRunState(dir, (fresh) => {
    const result = applyStepEvent(fresh, event);
    if (result.kind === 'error') {
      throw new Error(
        `Cannot record this migration into the run: ${result.reason}`
      );
    }
    return result.state;
  });
}

// Records a dependency install failure on the step before letting it fail the
// attempt. The 'failed' status says this attempt did not finish, not that the
// workspace's dependencies are missing, and the two part ways as soon as the
// agent skips the step or a later step's commit absorbs its diff: either one
// completes the run with node_modules stale and nothing left to warn about.
async function recordingInstallFailure<T>(
  dir: string,
  stepId: string,
  install: () => Promise<T>
): Promise<T> {
  try {
    return await install();
  } catch (e) {
    updateRunState(dir, (fresh) => markInstallFailed(fresh, stepId));
    throw e;
  }
}

// Finishes a step whose generator ran in an earlier attempt that then failed
// on the install or the commit. The generator's changes are already in the
// tree, so only those two are left, and the install compares against the
// step's persisted baseline rather than against what that generator wrote.
async function finishCompletedGenerator(
  dir: string,
  root: string,
  state: MigrateRunState,
  step: MigrateStep,
  migration: PlannedMigration,
  skipInstall: boolean,
  rerunCommand: string,
  scope: TreeScope
): Promise<MigrateRunState> {
  const installDeps = () =>
    recordingInstallFailure(dir, step.id, () =>
      installDepsChangedSinceDispense(
        root,
        dir,
        step,
        skipInstall,
        rerunCommand
      )
    );
  // Same no-op guard as the first attempt. Only an explicit false skips the
  // commit: absent means an older nx wrote the marker without recording the
  // answer, and the commit is kept as that version's retries did.
  if (!state.createCommits || step.generatorMadeChanges === false) {
    await installStepTree(dir, step, 'install', installDeps, scope);
    return state;
  }
  return commitStepChanges(
    dir,
    root,
    state,
    step,
    migration,
    installDeps,
    scope
  );
}

// Installs what the step changed, commits it, and records the result in the
// ledger, shared by a step's first attempt and by one that only has the commit
// left to do. The absorbed step ids are computed before the commit so the
// ledger entry and the commit body name the same ones.
async function commitStepChanges(
  dir: string,
  root: string,
  state: MigrateRunState,
  step: MigrateStep,
  migration: PlannedMigration,
  installDeps: () => Promise<void>,
  scope: TreeScope
): Promise<MigrateRunState> {
  const absorbedStepIds = uncoveredFailedStepIds(state).filter(
    (id) => id !== step.id
  );
  const recovery = commitFailureRecovery(state);
  let commit: BrokeredCommit;
  try {
    commit = await commitStepTree(
      dir,
      step,
      absorbedStepIds,
      () =>
        commitMigrationIfRequested(
          root,
          migration,
          true,
          state.commitPrefix,
          installDeps,
          stepsToPendingMigrations(state, absorbedStepIds),
          recovery
        ),
      scope
    );
  } catch (commitError) {
    // Nothing ran for a stale or refused request, so there is no debt.
    if (
      commitError instanceof BrokerStaleRequestError ||
      commitError instanceof TreeBusyError
    ) {
      throw commitError;
    }
    // The install failed, or the session ended unanswered and the commit may
    // or may not have landed; record the debt until a landed entry covers it.
    recordCommitEntry(dir, { kind: 'failed', stepIds: [step.id] });
    throw commitError;
  }
  if (commit.result.status === 'failed') {
    warnCommitFailed(migration.name, recovery);
  }
  const entry = commitResultToLedgerEntry(
    commit.result,
    step.id,
    commit.absorbedStepIds
  );
  // A session's parent records what it commits itself, receipt included.
  return entry && !commit.recorded ? recordCommitEntry(dir, entry) : state;
}

// The git commit itself already ran outside the lock; only this pure append is
// locked. A landed entry carries the resolved issues of every step it names,
// same as the orchestrator's fold and adopt appends: an absorbed step's
// resolutions would otherwise land unattached.
function recordCommitEntry(
  dir: string,
  entry: MigrateCommitLedgerEntry
): MigrateRunState {
  return updateRunState(dir, (fresh) =>
    appendCommit(fresh, attachIssueIdsToCommitEntry(fresh, entry))
  );
}

function buildOutcome(
  changes: FileChange[],
  nextSteps: string[],
  description: string | undefined,
  root: string
): MigrateStepOutcome {
  const outcome: MigrateStepOutcome = {};
  if (changes.length > 0) {
    outcome.fileChanges = changes.map((c) => c.path);
  }
  // Non-git repos have no HEAD; omit rather than record a placeholder.
  const gitRefAfter = getLatestCommitSha(root);
  if (gitRefAfter) {
    outcome.gitRefAfter = gitRefAfter;
  }
  if (nextSteps.length > 0) {
    outcome.nextSteps = nextSteps;
  }
  if (description) {
    outcome.summary = description;
  }
  return outcome;
}

interface OwedAgentWork {
  waived: boolean;
  validationOwed: boolean;
  promptOwed: boolean;
}

// `skipAgentic` counts as a waiver only when an AI step was owed.
function owedAgentWork(
  migration: PlannedMigration,
  shouldValidate: boolean,
  changes: FileChange[],
  skipAgentic: boolean
): OwedAgentWork {
  const hybrid = isHybridMigration(migration);
  const validationApplies = shouldValidate && !hybrid && changes.length > 0;
  const waived = skipAgentic && (hybrid || validationApplies);
  return {
    waived,
    validationOwed: validationApplies && !waived,
    promptOwed: hybrid && !waived,
  };
}

// Agent work payloads already carry `agentContext`; forward it separately
// only when an outer agent has no owed work.
function logWaiverOrForwardAgentContext(
  migration: PlannedMigration,
  work: OwedAgentWork,
  agentContext: string[],
  agenticKind: ResolvedAgentic['kind']
): void {
  if (work.waived) {
    logWaivedAgenticStep(migration, agentContext);
  } else if (
    !work.validationOwed &&
    !work.promptOwed &&
    agentContext.length > 0 &&
    agenticKind === 'inside-agent'
  ) {
    printDroppedAgentContextForOuterAgent({ migration, agentContext });
  }
}

function printNextSteps(
  migration: PlannedMigration,
  nextSteps: string[]
): void {
  if (nextSteps.length === 0) return;
  logToAgent({
    title: `Next steps for ${migration.package}: ${migration.name}`,
    bodyLines: nextSteps.map((line) => `- ${singleLine(line)}`),
  });
}

interface GeneratorImpl {
  logs: string;
  changes: FileChange[];
  agentContext: string[];
}

interface EmitPromptOptions {
  impl?: GeneratorImpl;
  resolvedCollection?: ResolvedMigrationCollection;
  // Set by recorded runs: the payload is stored here before the block is
  // emitted, so a later reconcile can re-emit it for the parked step.
  persistPath?: string;
}

function emitOrPrintPrompt(
  root: string,
  migration: PlannedMigration,
  agenticKind: ResolvedAgentic['kind'],
  opts: EmitPromptOptions = {}
): void {
  const migrationId = `${migration.package}:${migration.name}`;
  if (agenticKind === 'inside-agent') {
    const payload = promptPayload(
      root,
      migration,
      opts.impl,
      opts.resolvedCollection
    );
    if (opts.persistPath) {
      persistAgentWorkPayload(opts.persistPath, payload);
    }
    emitPromptForOuterAgent(
      migrationId,
      payload,
      opts.persistPath !== undefined
    );
  } else {
    printPromptForUser(
      root,
      migration,
      migration.prompt,
      resolveDocumentationPath(root, migration, opts.resolvedCollection)
    );
  }
}

function promptPayload(
  root: string,
  migration: PlannedMigration,
  impl: GeneratorImpl | undefined,
  resolvedCollection: ResolvedMigrationCollection | undefined
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    migrationId: `${migration.package}:${migration.name}`,
    prompt: migration.prompt,
  };
  const documentationPath = resolveDocumentationPath(
    root,
    migration,
    resolvedCollection
  );
  if (documentationPath) payload.documentationPath = documentationPath;
  if (impl) payload.impl = implPayload(impl);
  return payload;
}

const PROMPT_NOT_APPLIED = `The following prompt-based migration was not applied automatically.`;
// Recorded steps hand work back through the orchestrator, per the runbook's loop.
const RUN_NEXT_FIRST = `Run the dispensed "next" command first: its response restates this work and names the handoff file to write.`;
const CHANGES_AWAIT_VALIDATION = `The following migration's generator ran in an earlier attempt and its changes still await validation.`;

function emitPromptForOuterAgent(
  migrationId: string,
  payload: Record<string, unknown>,
  recorded: boolean
): void {
  logToAgent({
    title: recorded
      ? `${PROMPT_NOT_APPLIED} ${RUN_NEXT_FIRST}`
      : `${PROMPT_NOT_APPLIED} Apply it to this workspace, then continue.`,
  });
  emitPromptBlock(migrationId, payload);
}

function implPayload(impl: GeneratorImpl): Record<string, unknown> {
  return {
    logs: impl.logs,
    changes: impl.changes.map((c) => ({ type: c.type, path: c.path })),
    ...(impl.agentContext.length > 0
      ? { agentContext: impl.agentContext }
      : {}),
  };
}

// Re-hands what an earlier attempt stored. The payload is re-persisted under
// this attempt because the dispense reads only the current attempt's file.
function reemitCarriedAgentWork(
  migrationId: string,
  kind: Exclude<MigrateStepAwaitingKind, 'final-validation'>,
  payloadPath: string,
  payload: Record<string, unknown>
): void {
  persistAgentWorkPayload(payloadPath, payload);
  logToAgent({
    title: `${
      kind === 'migration-prompt'
        ? PROMPT_NOT_APPLIED
        : CHANGES_AWAIT_VALIDATION
    } ${RUN_NEXT_FIRST}`,
  });
  emitPromptBlock(migrationId, payload);
}

function printPromptForUser(
  root: string,
  migration: PlannedMigration,
  promptPath: string | undefined,
  documentationPath: string | undefined
): void {
  const bodyLines: string[] = [];
  if (promptPath) bodyLines.push(`Instructions file: ${promptPath}`);
  if (documentationPath) bodyLines.push(`Documentation: ${documentationPath}`);

  let content = '';
  let readErrorCode: string | undefined;
  if (promptPath) {
    try {
      content = readFileSync(join(root, promptPath), 'utf-8');
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      readErrorCode = err.code ?? err.message;
    }
  }

  if (readErrorCode) {
    // Point at the file and error code: the generic "review the instructions
    // above" copy would sit under an empty body.
    bodyLines.push(
      '',
      `The instructions file '${promptPath}' could not be read (${readErrorCode}). Open it manually and apply the instructions.`
    );
  } else {
    if (content) {
      bodyLines.push('', ...content.split('\n'));
    }
    bodyLines.push(
      '',
      'Review the instructions above and apply them manually.'
    );
  }
  logToAgent({
    title: `Prompt-based migration ${migration.package}: ${migration.name} must be applied manually`,
    bodyLines,
  });
}

// `impl` is absent on a retry whose earlier attempt left no stored payload;
// the emission then points at the tree.
function emitValidationBlock(
  root: string,
  migration: PlannedMigration,
  impl: GeneratorImpl | undefined,
  opts: Omit<EmitPromptOptions, 'impl'> = {}
): void {
  const payload = validationPayload(
    root,
    migration,
    impl,
    opts.resolvedCollection
  );
  if (opts.persistPath) {
    persistAgentWorkPayload(opts.persistPath, payload);
  }
  emitValidationPayload(
    `${migration.package}:${migration.name}`,
    payload,
    opts.persistPath !== undefined
  );
}

function emitValidationPayload(
  migrationId: string,
  payload: Record<string, unknown>,
  recorded: boolean
): void {
  logToAgent({
    title:
      payload.impl === undefined
        ? `${CHANGES_AWAIT_VALIDATION} ${RUN_NEXT_FIRST} Inspect the changes with git.`
        : `The following migration's generator ran without an AI-driven part. ${
            recorded
              ? RUN_NEXT_FIRST
              : "Validate its changes in this workspace, fixing only what lies within the migration's scope, then continue."
          }`,
  });
  emitPromptBlock(migrationId, payload);
}

function validationPayload(
  root: string,
  migration: PlannedMigration,
  impl: GeneratorImpl | undefined,
  resolvedCollection: ResolvedMigrationCollection | undefined
): Record<string, unknown> {
  // `kind` is what tells the block apart from an applied-prompt payload,
  // which carries `prompt` instead.
  const payload: Record<string, unknown> = {
    migrationId: `${migration.package}:${migration.name}`,
    kind: 'generator-validation',
  };
  const documentationPath = resolveDocumentationPath(
    root,
    migration,
    resolvedCollection
  );
  if (documentationPath) payload.documentationPath = documentationPath;
  if (impl) payload.impl = implPayload(impl);
  return payload;
}

// Non-fatal: documentation is supplementary, so a failure warns and the
// prompt still runs without it.
function resolveDocumentationPath(
  root: string,
  migration: PlannedMigration,
  resolvedCollection?: ResolvedMigrationCollection
): string | undefined {
  if (!migration.documentation) return undefined;
  let documentationPath: string | undefined;
  try {
    const { collectionPath } =
      resolvedCollection ?? readMigrationCollection(migration.package, root);
    documentationPath = resolveDocumentationFileToWorkspacePath(
      root,
      dirname(collectionPath),
      migration.documentation
    );
  } catch {
    // An unreadable collection is reported through the warning below.
  }
  if (!documentationPath) {
    warnToAgent({
      title: `Could not resolve the "documentation" file "${migration.documentation}" declared for migration "${migration.package}: ${migration.name}". It will be skipped.`,
    });
  }
  return documentationPath;
}
