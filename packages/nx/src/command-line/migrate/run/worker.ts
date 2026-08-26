import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import type { FileChange } from '../../../generators/tree';
import { getLatestCommitSha, isGitRepository } from '../../../utils/git-utils';
import { readJsonFile } from '../../../utils/fileutils';
import { getNxRequirePaths } from '../../../utils/installation-directory';
import { readModulePackageJson } from '../../../utils/package-json';
import { printDroppedAgentContextForOuterAgent } from '../agentic/print-dropped-agent-context';
import type {
  AgenticRunContext,
  AgenticStepResult,
  RunAgenticPromptStepInput,
} from '../agentic/run-step';
import {
  resolveAgentic,
  resolveShouldRunValidation,
  type AgenticArg,
} from '../agentic/select';
import {
  MIGRATE_RUNS_RELATIVE_DIR,
  type EnabledResolvedAgentic,
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
  reportMigrateSingleMigrationInvocation,
} from '../migrate-analytics';
import {
  commitCheckpointBeforeMigrations,
  commitMigrationIfRequested,
  confirmMigrationCommitsOnDefaultBranch,
  resolveCreateCommits,
  type CommitResult,
} from '../migrate-commits';
import {
  logAgenticSuccessOutcome,
  logWaivedAgenticStep,
} from '../migrate-output';
import {
  isHybridMigration,
  isPromptOnlyMigration,
  type PlannedMigration,
} from '../migration-shape';
import { canPrompt } from '../safe-prompt';
import {
  findActiveRun,
  hasRunState,
  NewerRunStateFormatError,
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
  applyStepEvent,
  commitResultToLedgerEntry,
  latestRound,
  markInstallFailed,
  stepsToPendingMigrations,
  uncoveredFailedStepIds,
  type StepEvent,
} from './state-machine';
import { updateRunState } from './state-lock';
import {
  installDepsChangedSinceDispense,
  nowIso,
  pmExecPrefix,
  recordInstallLanded,
  summarizeError,
  warnCommitFailed,
} from './util';
import { singleLine } from '../text';
import { emitPromptBlock, logToAgent, warnToAgent } from './agent-output';
import {
  agentWorkPayloadPath,
  latestStoredAgentWorkPayload,
  persistAgentWorkPayload,
} from './agent-work-payload';
import { issueIdsForCommit } from './issues';

// Runs exactly one migration, either standalone or recorded into an existing
// orchestrated run via `--run-id`. Standalone runs keep no durable run state,
// though an enabled agentic flow still writes per-run scratch under
// `.nx/migrate-runs/<version>/handoffs/` and creates commits by default.

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
): Promise<void> {
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

  const { migrations, source } = readMigrationsSource(root, runId);
  const migration = resolveMigration(migrations, runMigration, source);

  reportMigrateSingleMigrationInvocation({
    migrationType: isPromptOnlyMigration(migration)
      ? 'prompt'
      : isHybridMigration(migration)
        ? 'hybrid'
        : 'generator',
    orchestrated: !!runId,
  });

  if (runId) {
    // A recorded run takes its commit config from run.json and is driven by
    // the outer agent, so the standalone resolution below doesn't apply. That
    // includes the default-branch confirmation: the run decided once, at init,
    // whether to commit, and asking again would re-prompt on every step.
    await runRecorded(root, runId, migration, skipInstall, isVerbose);
    return;
  }

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

  if (
    createCommits &&
    canPrompt(interactive) &&
    !(await confirmMigrationCommitsOnDefaultBranch(
      root,
      'running the migration'
    ))
  ) {
    return;
  }

  await runStandalone(root, migration, {
    agentic,
    createCommits,
    agenticHasDiffContext: resolved.agenticHasDiffContext,
    shouldRunValidation: resolveShouldRunValidation({
      validate: input.validate,
      agenticKind: agentic.kind,
    }),
    commitPrefix,
    skipInstall,
    isVerbose,
  });
}

function readMigrationsSource(
  root: string,
  runId: string | undefined
): { migrations: PlannedMigration[]; source: string } {
  if (runId) {
    const dir = runDir(root, runId);
    // A missing run.json would surface a raw ENOENT from readRunState's
    // readFileSync; report it the way the orchestrator does instead, down to
    // carrying no remediation: starting a run is a separate, gated entry point,
    // and `--run-migrations` would run the whole plan in process instead.
    if (!hasRunState(dir)) {
      throw new Error(
        `No migrate run '${runId}' was found under ${MIGRATE_RUNS_RELATIVE_DIR}.`
      );
    }
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
  agentic: ResolvedAgentic;
  createCommits: boolean;
  agenticHasDiffContext: boolean;
  shouldRunValidation: boolean;
  commitPrefix: string;
  skipInstall: boolean;
  isVerbose: boolean;
}

async function runStandalone(
  root: string,
  migration: PlannedMigration,
  opts: StandaloneRunOptions
): Promise<void> {
  const { agentic, createCommits, commitPrefix, skipInstall, isVerbose } = opts;

  // Standalone never writes run state. Warn (don't block) when an orchestrated
  // run is active so the user knows this execution won't be recorded into it.
  // A newer-nx run dir must not hard-block this stateless path (the fail-closed
  // refusal in run-state.ts targets run-starting callers); tolerate it and skip
  // the warning. A failed scan can't block it either, but gets a warning of its
  // own: an active run may exist that this execution silently won't record into.
  let active: ReturnType<typeof findActiveRun>['active'];
  try {
    active = findActiveRun(root).active;
  } catch (e) {
    if (!(e instanceof NewerRunStateFormatError)) {
      warnToAgent({
        title: `Could not check for an active migrate run: ${
          e instanceof Error ? e.message : e
        }`,
      });
    }
    active = null;
  }
  if (active) {
    warnToAgent({
      title: `This migration won't be recorded into the active migrate run '${active.runId}'.`,
      bodyLines: [
        `Pass --run-id=${active.runId} to record it into that run instead.`,
      ],
    });
  }

  if (isPromptOnlyMigration(migration)) {
    if (agentic.kind !== 'enabled') {
      // No agent to apply the prompt, so nothing runs: no checkpoint, no
      // commit.
      emitOrPrintPrompt(root, migration, agentic.kind);
      return;
    }

    // Checkpoint pre-existing working-tree state first, or the migration
    // commit's `git add -A` folds it in.
    if (createCommits) {
      commitCheckpointBeforeMigrations(root, commitPrefix);
    }
    const agenticRun = await prepareAgenticRun(
      root,
      migration,
      agentic,
      createCommits,
      commitPrefix
    );
    const installer = new ChangedDepInstaller(
      root,
      skipInstall,
      formatSingleMigrationRerunCommand(
        `${migration.package}:${migration.name}`
      )
    );
    const installDepsIfChanged = () => installer.installDepsIfChanged();
    const stepResult = await runAgenticStep(agenticRun, {
      root,
      migration,
      installDepsIfChanged,
      documentationPath: resolveDocumentationPath(root, migration),
    });
    await commitAndLogAgenticOutcome({
      root,
      migration,
      createCommits,
      commitPrefix,
      installDepsIfChanged,
      successLabel: 'Applied',
      stepResult,
    });
    if (installer.skippedInstall) {
      logSkippedPostMigrationInstall(root);
    }
    return;
  }

  if (createCommits) {
    commitCheckpointBeforeMigrations(root, commitPrefix);
  }

  const agenticRun =
    agentic.kind === 'enabled'
      ? await prepareAgenticRun(
          root,
          migration,
          agentic,
          createCommits,
          commitPrefix
        )
      : undefined;

  const installer = new ChangedDepInstaller(
    root,
    skipInstall,
    formatSingleMigrationRerunCommand(`${migration.package}:${migration.name}`)
  );
  const installDepsIfChanged = () => installer.installDepsIfChanged();

  const validationRun =
    agenticRun && opts.shouldRunValidation ? agenticRun : undefined;
  const resolvedCollection = readMigrationCollection(migration.package, root);
  const { changes, nextSteps, agentContext, skipAgentic, logs, madeChanges } =
    await runNxOrAngularMigration(
      root,
      migration,
      isVerbose,
      isHybridMigration(migration) || !!validationRun,
      resolvedCollection
    );

  // Whether an AI step was on the table for `skipAgentic` to waive. A hybrid
  // owes its prompt in every agentic mode; a generator-only migration owes
  // only the validation pass, and only where one would have run.
  const validationApplies = !!validationRun && changes.length > 0;
  const waivedAgenticStep =
    skipAgentic && (isHybridMigration(migration) || validationApplies);

  if (isHybridMigration(migration) && agenticRun && !skipAgentic) {
    // The prompt half may need the deps the generator half added, so install
    // before the agent runs.
    await installDepsIfChanged();
    const stepResult = await runAgenticStep(agenticRun, {
      root,
      migration,
      installDepsIfChanged,
      documentationPath: resolveDocumentationPath(
        root,
        migration,
        resolvedCollection
      ),
      implContext: {
        logs,
        changes,
        agentContext,
        // No prior migrations run here, so unlike the classic loop there is no
        // pending-commit debt to suppress the git-inspect context for.
        hasDiffContext: opts.agenticHasDiffContext,
      },
    });
    await commitAndLogAgenticOutcome({
      root,
      migration,
      createCommits,
      commitPrefix,
      installDepsIfChanged,
      successLabel: 'Applied',
      stepResult,
    });
    if (installer.skippedInstall) {
      logSkippedPostMigrationInstall(root);
    }
    printNextSteps(migration, nextSteps);
    return;
  }

  if (validationApplies && !skipAgentic) {
    // Commit after validation: a failed validation throws, leaving the changes
    // in the working tree for review.
    await installDepsIfChanged();
    const stepResult = await runAgenticStep(validationRun, {
      root,
      migration,
      installDepsIfChanged,
      documentationPath: resolveDocumentationPath(
        root,
        migration,
        resolvedCollection
      ),
      implContext: {
        logs,
        changes,
        agentContext,
        hasDiffContext: opts.agenticHasDiffContext,
      },
      mode: 'generic-validation',
    });
    await commitAndLogAgenticOutcome({
      root,
      migration,
      createCommits,
      commitPrefix,
      installDepsIfChanged,
      successLabel: 'Validation passed',
      stepResult,
    });
    if (installer.skippedInstall) {
      logSkippedPostMigrationInstall(root);
    }
    printNextSteps(migration, nextSteps);
    return;
  }

  if (waivedAgenticStep) {
    logWaivedAgenticStep(migration, agentContext);
  } else if (!isHybridMigration(migration)) {
    forwardDroppedAgentContext(migration, agentContext, agentic.kind);
  }

  // A no-op migration must not build a commit whose `git add -A` absorbs
  // unrelated pending diffs under its name. The commit path installs deps
  // itself, so the else branch does it here instead.
  if (createCommits && madeChanges) {
    await attemptStandaloneCommit(
      root,
      migration,
      createCommits,
      commitPrefix,
      installDepsIfChanged
    );
  } else {
    await installer.installDepsIfChanged();
  }

  if (installer.skippedInstall) {
    logSkippedPostMigrationInstall(root);
  }

  printNextSteps(migration, nextSteps);

  // A waived prompt is not deferred, so it gets no hand-off to an outer agent
  // and no "apply this manually" block for the user either.
  if (isHybridMigration(migration) && !skipAgentic) {
    emitOrPrintPrompt(root, migration, agentic.kind, {
      impl: {
        logs,
        changes,
        agentContext,
      },
      resolvedCollection,
    });
  }
}

async function runRecorded(
  root: string,
  runId: string,
  migration: PlannedMigration,
  skipInstall: boolean,
  isVerbose: boolean
): Promise<void> {
  const dir = runDir(root, runId);
  // Version refusal (NewerRunStateFormatError) propagates.
  let state = readRunState(dir);

  // A recorded run never resolves the agentic flow: the outer agent drives it,
  // and the dispensed command is part of the orchestrated protocol whoever
  // re-runs it. Gating the block on ambient agent detection would park the
  // step awaiting an outcome whose payload was never emitted.
  const agenticKind: ResolvedAgentic['kind'] = 'inside-agent';

  const migrationId = `${migration.package}:${migration.name}`;
  // The plan was read from the latest round's snapshot, so only that round's
  // step may match; a same-id step from an older round must not.
  const latest = latestRound(state);
  const step = state.steps.find(
    (s) => s.migrationId === migrationId && s.roundIndex === latest?.index
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
  // The run records its own install policy because dispensed worker commands
  // are re-invoked by the loop and never carry the user's flags; an explicit
  // --skip-install on this invocation still applies on top of it.
  const effectiveSkipInstall = state.skipInstall === true || skipInstall;
  // The run records the resolved validation policy at init; absent (a state
  // predating the field) falls back to the same default init applies.
  const shouldValidate = state.validate !== false;
  // Called before a retry hands the step's work back: the prompt or validation
  // may need the dependencies the earlier attempt's generator added.
  const reinstallFromBaseline = () =>
    recordingInstallFailure(dir, step.id, () =>
      installDepsChangedSinceDispense(
        root,
        dir,
        startedStep,
        effectiveSkipInstall,
        `${formatSingleMigrationRerunCommand(migrationId)} --run-id=${runId}`
      )
    );

  let outcome: MigrateStepOutcome | undefined;
  let awaitingKind: MigrateStepAwaitingKind | undefined;
  const payloadPath = agentWorkPayloadPath(dir, step.id, startedStep.attempt);
  try {
    if (isPromptOnlyMigration(migration)) {
      emitOrPrintPrompt(root, migration, agenticKind, {
        persistPath: payloadPath,
      });
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
      // The persisted flag is the only record that these changes still owe a
      // validation pass: the decision needed the generator result, which is
      // gone with the attempt that made it, and a true waiver never writes the
      // flag. The commit stays with the fold, as on a first attempt.
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
      // Reached when the earlier attempt waived the AI step, or none was owed
      // (no changes, validation off, or an older-nx state).
      state = await finishCompletedGenerator(
        dir,
        root,
        state,
        startedStep,
        migration,
        effectiveSkipInstall,
        runId
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
        `${formatSingleMigrationRerunCommand(migrationId)} --run-id=${runId}`
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

      // Mirrors the classic loop's waiver semantics (migrate.ts): the two must
      // agree on when an AI step was owed for skipAgentic to waive.
      const validationApplies =
        shouldValidate && !isHybridMigration(migration) && changes.length > 0;
      const waivedAgenticStep =
        skipAgentic && (isHybridMigration(migration) || validationApplies);
      const validationOwed = validationApplies && !waivedAgenticStep;
      const promptOwed = isHybridMigration(migration) && !waivedAgenticStep;

      // Recorded before the commit is attempted: from here on the changes are
      // in the tree, so a failed install or commit must leave a retry with
      // only those left to do rather than running the generator again. The
      // waiver and the owed validation ride along so that retry re-emits
      // exactly the agent work this attempt decided was owed.
      state = transition(dir, {
        type: 'markGeneratorCompleted',
        stepId: step.id,
        agenticWaived: waivedAgenticStep,
        validationOwed,
        madeChanges,
      });

      if (waivedAgenticStep) {
        logWaivedAgenticStep(migration, agentContext);
      } else if (!isHybridMigration(migration) && !validationApplies) {
        forwardDroppedAgentContext(migration, agentContext, agenticKind);
      }

      const install = () =>
        recordingInstallFailure(dir, step.id, () =>
          installer.installDepsIfChanged()
        );

      // Commits follow the run config, not CLI flags, and only when the
      // generator changed something: a no-op step's commit would absorb prior
      // pending diffs under its name. A step handing work back defers its
      // commit to the fold, so the migration lands as one commit and a failed
      // hand-back leaves the changes uncommitted for review, as in the classic
      // loop. The install still runs first: the agent may run tasks that need
      // what the generator added.
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
          step,
          migration,
          install
        );
      } else {
        await install();
      }

      if (installer.skippedInstall) {
        logSkippedPostMigrationInstall(root);
      } else if (installer.installed) {
        recordInstallLanded(root, dir, step.id);
      }

      printNextSteps(migration, nextSteps);

      if (validationOwed) {
        emitValidationBlock(
          root,
          migration,
          { logs, changes, agentContext },
          { resolvedCollection, persistPath: payloadPath }
        );
        awaitingKind = 'generator-validation';
      } else if (promptOwed) {
        emitOrPrintPrompt(root, migration, agenticKind, {
          impl: {
            logs,
            changes,
            agentContext,
          },
          resolvedCollection,
          persistPath: payloadPath,
        });
        awaitingKind = 'migration-prompt';
      } else {
        outcome = buildOutcome(changes, nextSteps, migration.description, root);
      }
    }
  } catch (e) {
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
    return;
  }

  transition(dir, {
    type: 'succeed',
    stepId: step.id,
    finishedAt: nowIso(),
    ...(outcome ? { outcome } : {}),
  });
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
  runId: string
): Promise<MigrateRunState> {
  const migrationId = `${migration.package}:${migration.name}`;
  const installDeps = () =>
    recordingInstallFailure(dir, step.id, () =>
      installDepsChangedSinceDispense(
        root,
        dir,
        step,
        skipInstall,
        `${formatSingleMigrationRerunCommand(migrationId)} --run-id=${runId}`
      )
    );
  // Same no-op guard as the first attempt. Only an explicit false skips the
  // commit: absent means an older nx wrote the marker without recording the
  // answer, and the commit is kept as that version's retries did.
  if (!state.createCommits || step.generatorMadeChanges === false) {
    await installDeps();
    return state;
  }
  return commitStepChanges(dir, root, state, step, migration, installDeps);
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
  installDeps: () => Promise<void>
): Promise<MigrateRunState> {
  const absorbedStepIds = uncoveredFailedStepIds(state).filter(
    (id) => id !== step.id
  );
  let result: CommitResult;
  try {
    result = await commitMigrationIfRequested(
      root,
      migration,
      true,
      state.commitPrefix,
      installDeps,
      stepsToPendingMigrations(state, absorbedStepIds)
    );
  } catch (commitError) {
    // A post-migration install failure leaves the diff uncommitted; record the
    // debt so only a landed entry can cover it.
    appendCommit(dir, { kind: 'failed', stepIds: [step.id] });
    throw commitError;
  }
  if (result.status === 'failed') {
    warnCommitFailed(migration.name);
  }
  const entry = commitResultToLedgerEntry(result, step.id, absorbedStepIds);
  return entry ? appendCommit(dir, entry) : state;
}

// The git commit itself already ran outside the lock; only this pure append is
// locked. A landed entry carries the resolved issues of every step it names,
// same as the orchestrator's fold and adopt appends: an absorbed step's
// resolutions would otherwise land unattached.
function appendCommit(
  dir: string,
  entry: MigrateCommitLedgerEntry
): MigrateRunState {
  return updateRunState(dir, (fresh) => {
    let withIssues = entry;
    if (entry.kind === 'landed') {
      const issueIds = issueIdsForCommit(fresh, entry.stepIds);
      if (issueIds.length > 0) {
        withIssues = { ...entry, issueIds };
      }
    }
    return {
      ...fresh,
      commits: [...fresh.commits, withIssues],
    };
  });
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

// Only `run-step` is actually deferred by these requires, and it is the one
// worth deferring: it pulls in the prompt builders, which nothing but an
// enabled agentic flow needs. The other two are loaded either way, since the
// `run/` barrel every caller comes through re-exports `orchestrator.ts`, which
// imports both statically.
async function prepareAgenticRun(
  root: string,
  migration: PlannedMigration,
  agentic: EnabledResolvedAgentic,
  effectiveCreateCommits: boolean,
  commitPrefix: string
): Promise<AgenticRunContext> {
  const { applyAgenticHandoffGitignoreFallback } =
    require('../agentic/handoff-gitignore') as typeof import('../agentic/handoff-gitignore');
  const { packageJson: nxPackageJson } = readModulePackageJson(
    'nx',
    getNxRequirePaths(root)
  );
  await applyAgenticHandoffGitignoreFallback({
    migrations: [migration],
    installedNxVersion: nxPackageJson.version,
    effectiveCreateCommits,
    commitPrefix,
    root,
  });

  const { initRunDir, resolveAgenticRunId } =
    require('../agentic/handoff') as typeof import('../agentic/handoff');
  const { runAgenticPromptStep } =
    require('../agentic/run-step') as typeof import('../agentic/run-step');
  return {
    agentic,
    runDir: initRunDir(root, resolveAgenticRunId([migration])),
    runStep: runAgenticPromptStep,
  };
}

async function runAgenticStep(
  agenticRun: AgenticRunContext,
  input: Omit<RunAgenticPromptStepInput, 'agentic' | 'runDir'>
): Promise<AgenticStepResult> {
  try {
    return await agenticRun.runStep({
      ...input,
      agentic: agenticRun.agentic,
      runDir: agenticRun.runDir,
    });
  } catch (e) {
    reportMigrateRunError({
      code: 'agentic',
      migrationPackage: input.migration.package,
      migrationName: input.migration.name,
      error: e,
    });
    throw e;
  }
}

// A standalone run has no later commit or end-of-run recap to absorb a failed
// commit's diff, so it passes its own guidance instead of the default.
// `commitMigrationIfRequested` logs a failed commit itself with that guidance.
function attemptStandaloneCommit(
  root: string,
  migration: PlannedMigration,
  createCommits: boolean,
  commitPrefix: string,
  installDepsIfChanged: () => Promise<void>
): Promise<CommitResult> {
  return commitMigrationIfRequested(
    root,
    migration,
    createCommits,
    commitPrefix,
    installDepsIfChanged,
    [],
    'Commit or revert the changes manually.'
  );
}

async function commitAndLogAgenticOutcome(args: {
  root: string;
  migration: PlannedMigration;
  createCommits: boolean;
  commitPrefix: string;
  installDepsIfChanged: () => Promise<void>;
  successLabel: string;
  stepResult: AgenticStepResult;
}): Promise<void> {
  const commit = await attemptStandaloneCommit(
    args.root,
    args.migration,
    args.createCommits,
    args.commitPrefix,
    args.installDepsIfChanged
  );
  logAgenticSuccessOutcome(
    args.stepResult.ambiguous ? 'Marked complete by user' : args.successLabel,
    commit.status === 'committed' ? commit.sha : null,
    args.stepResult.summary
  );
}

// Hybrids are excluded by the caller: their `agentContext` rides in the
// prompt payload instead.
function forwardDroppedAgentContext(
  migration: PlannedMigration,
  agentContext: string[],
  agenticKind: ResolvedAgentic['kind']
): void {
  if (agentContext.length > 0 && agenticKind === 'inside-agent') {
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

interface EmitPromptOptions {
  impl?: { logs: string; changes: FileChange[]; agentContext: string[] };
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
  const promptPath = migration.prompt;
  const documentationPath = resolveDocumentationPath(
    root,
    migration,
    opts.resolvedCollection
  );

  if (agenticKind === 'inside-agent') {
    emitPromptForOuterAgent(
      migrationId,
      promptPath,
      documentationPath,
      opts.impl,
      opts.persistPath
    );
  } else {
    printPromptForUser(root, migration, promptPath, documentationPath);
  }
}

function emitPromptForOuterAgent(
  migrationId: string,
  promptPath: string | undefined,
  documentationPath: string | undefined,
  impl:
    | { logs: string; changes: FileChange[]; agentContext: string[] }
    | undefined,
  persistPath: string | undefined
): void {
  const payload: Record<string, unknown> = { migrationId, prompt: promptPath };
  if (documentationPath) payload.documentationPath = documentationPath;
  if (impl) {
    payload.impl = implPayload(impl);
  }
  if (persistPath) {
    persistAgentWorkPayload(persistPath, payload);
  }
  logToAgent({
    title: `The following prompt-based migration was not applied automatically. Apply it to this workspace, then continue.`,
  });
  emitPromptBlock(migrationId, payload);
}

function implPayload(impl: {
  logs: string;
  changes: FileChange[];
  agentContext: string[];
}): Record<string, unknown> {
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
  kind: MigrateStepAwaitingKind,
  payloadPath: string,
  payload: Record<string, unknown>
): void {
  persistAgentWorkPayload(payloadPath, payload);
  logToAgent({
    title:
      kind === 'migration-prompt'
        ? `The following prompt-based migration was not applied automatically. Apply it to this workspace, then continue.`
        : `The following migration's generator ran in an earlier attempt and its changes still await validation. Validate them per the runbook's validation scope rules, then continue.`,
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

// `impl` is absent on a retry, where the generator ran in an earlier attempt
// and its captured output is gone; the emission then points at the tree.
function emitValidationBlock(
  root: string,
  migration: PlannedMigration,
  impl:
    | { logs: string; changes: FileChange[]; agentContext: string[] }
    | undefined,
  opts: Omit<EmitPromptOptions, 'impl'> = {}
): void {
  const migrationId = `${migration.package}:${migration.name}`;
  const documentationPath = resolveDocumentationPath(
    root,
    migration,
    opts.resolvedCollection
  );

  // `kind` is what tells the block apart from an applied-prompt payload,
  // which carries `prompt` instead.
  const payload: Record<string, unknown> = {
    migrationId,
    kind: 'generator-validation',
  };
  if (documentationPath) payload.documentationPath = documentationPath;
  if (impl) {
    payload.impl = implPayload(impl);
  }
  if (opts.persistPath) {
    persistAgentWorkPayload(opts.persistPath, payload);
  }
  logToAgent({
    title: impl
      ? `The following migration's generator ran without an AI-driven part. Validate its changes per the runbook's validation scope rules, then continue.`
      : `The following migration's generator ran in an earlier attempt and its changes still await validation. Inspect them with git, validate them per the runbook's validation scope rules, then continue.`,
  });
  emitPromptBlock(migrationId, payload);
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
