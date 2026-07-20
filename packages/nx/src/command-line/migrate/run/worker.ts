import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { readNxJson } from '../../../config/configuration';
import type { FileChange } from '../../../generators/tree';
import {
  getGitCurrentBranch,
  getLatestCommitSha,
  isGitRepository,
} from '../../../utils/git-utils';
import { getBaseRef } from '../../../utils/command-line-utils';
import { readJsonFile } from '../../../utils/fileutils';
import { getNxRequirePaths } from '../../../utils/installation-directory';
import { logger } from '../../../utils/logger';
import { output } from '../../../utils/output';
import { readModulePackageJson } from '../../../utils/package-json';
import { isInsideAgent } from '../agentic/inception';
import {
  escapeXmlAttr,
  printDroppedAgentContextForOuterAgent,
} from '../agentic/print-dropped-agent-context';
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
import type { EnabledResolvedAgentic, ResolvedAgentic } from '../agentic/types';
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
  confirmCommitsOnDefaultBranch,
  resolveCreateCommits,
  type CommitResult,
} from '../migrate-commits';
import { logAgenticSuccessOutcome } from '../migrate-output';
import {
  isHybridMigration,
  isPromptOnlyMigration,
  type PlannedMigration,
} from '../migration-shape';
import { canPrompt } from '../safe-prompt';
import {
  findActiveRun,
  NewerRunStateFormatError,
  readRunState,
  runDir,
  type MigrateCommitLedgerEntry,
  type MigrateRunState,
  type MigrateStep,
  type MigrateStepOutcome,
} from './run-state';
import { RUN_ID_SAFE } from './run-id';
import {
  applyStepEvent,
  commitResultToLedgerEntry,
  latestRound,
  stepsToPendingMigrations,
  uncoveredFailedStepIds,
  type StepEvent,
} from './state-machine';
import { updateRunState } from './state-lock';
import { nowIso, pmExecPrefix, summarizeError, warnCommitFailed } from './util';

// The `ng update <pkg> --migrate-only --name=<migration>` analog: run exactly
// one migration from the migrations file, either standalone or recorded into
// an existing orchestrated run via `--run-id`. Standalone runs keep no durable
// run state, though an enabled agentic flow still writes its per-run scratch
// under `.nx/migrate-runs/<version>/` and creates commits by default.

export interface RunSingleMigrationWorkerInput {
  root: string;
  options: { runMigration: string; runId?: string };
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
  const { root, options, commitPrefix, interactive, skipInstall, isVerbose } =
    input;

  // The worker is a second CLI entry point: the run id reaches runDir() (where
  // join resolves '..'), so validate it up front exactly as the orchestrator
  // does before it trusts a run id.
  if (options.runId !== undefined && !RUN_ID_SAFE.test(options.runId)) {
    throw new Error(`Invalid run id '${options.runId}'.`);
  }

  const { migrations, source } = readMigrationsSource(root, options.runId);
  const migration = resolveMigration(migrations, options.runMigration, source);

  reportMigrateSingleMigrationInvocation({
    migrationType: isPromptOnlyMigration(migration)
      ? 'prompt'
      : isHybridMigration(migration)
        ? 'hybrid'
        : 'generator',
    orchestrated: !!options.runId,
  });

  if (options.runId) {
    // A recorded run takes its commit config from run.json and is driven by
    // the outer agent, so the standalone resolution below doesn't apply.
    await runRecorded(root, options.runId, migration, skipInstall, isVerbose);
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

  // Same resolution as the classic loop: agentic spawn mode enables commits by
  // default, --create-commits without a git repo is a hard error, and a custom
  // prefix without commits warns.
  const resolved = resolveCreateCommits({
    createCommits: input.createCommits,
    agenticKind: agentic.kind,
    isGitRepo: isGitRepository(root),
    commitPrefixIsCustom: commitPrefix !== DEFAULT_MIGRATION_COMMIT_PREFIX,
  });
  if (resolved.error) {
    throw new Error(resolved.error);
  }
  if (resolved.warning) {
    output.warn({ title: resolved.warning });
  }
  const createCommits = resolved.effective;

  // Confirm before committing on the default branch when prompting is
  // possible; a decline aborts before the migration runs.
  if (createCommits && canPrompt(interactive)) {
    const currentBranch = getGitCurrentBranch(root);
    // `getBaseRef` may carry an `origin/` prefix (set by the CI-workflow
    // generator); compare against the local branch name.
    const defaultBranch = getBaseRef(readNxJson(root)).replace(/^origin\//, '');
    const proceed = await confirmCommitsOnDefaultBranch({
      currentBranch,
      defaultBranch,
    });
    if (!proceed) {
      output.log({
        title: `Skipped running the migration to avoid committing to the default branch '${currentBranch}'.`,
        bodyLines: [
          'Switch to a different branch and re-run, or re-run and confirm to proceed.',
        ],
      });
      return;
    }
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
    // A missing run dir would surface a raw ENOENT from readRunState's
    // readFileSync; report it the way the orchestrator does instead.
    if (!existsSync(dir)) {
      throw new Error(
        `No migrate run '${runId}' was found under .nx/migrate-runs. Start one with \`${pmExecPrefix(
          root
        )} nx migrate --run-migrations\` before recording into it.`
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
  // '<package>:<name>' splits on the first ':', leaving names that themselves
  // contain a ':' intact; a bare id matches on name only.
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
  // the warning.
  let active: ReturnType<typeof findActiveRun>;
  try {
    active = findActiveRun(root);
  } catch (e) {
    if (!(e instanceof NewerRunStateFormatError)) {
      throw e;
    }
    active = null;
  }
  if (active) {
    output.warn({
      title: `This migration won't be recorded into the active migrate run '${active.runId}'.`,
      bodyLines: [
        `Pass --run-id=${active.runId} to record it into that run instead.`,
      ],
    });
  }

  if (isPromptOnlyMigration(migration)) {
    // Without an agent to apply it, a prompt-only migration is only surfaced;
    // nothing runs, so nothing is checkpointed or committed.
    if (agentic.kind !== 'enabled') {
      emitOrPrintPrompt(root, migration, agentic.kind);
      return;
    }

    // Same order as the classic loop: checkpoint pre-existing working-tree
    // state first (so the commit's `git add -A` can't fold it into the
    // migration's commit), then the agentic preflight.
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

  // Same checkpoint-then-preflight order as the prompt-only path above.
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
  // Read once; the run and the documentation resolutions below share it.
  const resolvedCollection = readMigrationCollection(migration.package, root);
  const { changes, nextSteps, agentContext, logs, madeChanges } =
    await runNxOrAngularMigration(
      root,
      migration,
      isVerbose,
      isHybridMigration(migration) || !!validationRun,
      resolvedCollection
    );

  if (isHybridMigration(migration) && agenticRun) {
    // Install any deps the deterministic phase added/bumped before the agent
    // runs; the prompt half may depend on them being present in node_modules.
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

  if (validationRun && changes.length > 0) {
    // Defer the commit until validation succeeds; a failed validation throws
    // and leaves the changes uncommitted in the working tree for review.
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

  if (!isHybridMigration(migration)) {
    forwardDroppedAgentContext(migration, agentContext, agentic.kind);
  }

  // Commit only when commits are on and the generator changed something: a
  // no-op migration must not build a commit whose `git add -A` absorbs prior
  // pending diffs under its name. When commits run, the install happens inside
  // the commit; otherwise it runs on its own here.
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

  if (isHybridMigration(migration)) {
    emitOrPrintPrompt(
      root,
      migration,
      agentic.kind,
      {
        logs,
        changes,
        agentContext,
      },
      resolvedCollection
    );
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

  // A recorded run never resolves the agentic flow (the outer agent drives
  // it); prompts are emitted for that agent or printed for a user hand-running
  // the dispensed command.
  const agenticKind: ResolvedAgentic['kind'] = isInsideAgent()
    ? 'inside-agent'
    : 'disabled';

  const migrationId = `${migration.package}:${migration.name}`;
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

  // A prior attempt's generator half already ran and committed, so a plain
  // retry must not reapply it against a tree that already holds its changes.
  // Read from the state the start transition returned: a delayed invocation
  // may have claimed a later attempt whose flag its entry snapshot predates.
  const startedStep = state.steps.find((s) => s.id === step.id);
  const generatorAlreadyCompleted =
    isHybridMigration(migration) && startedStep.generatorCompleted === true;

  let outcome: MigrateStepOutcome | undefined;
  try {
    if (isPromptOnlyMigration(migration) || generatorAlreadyCompleted) {
      emitOrPrintPrompt(root, migration, agenticKind);
    } else {
      const installer = new ChangedDepInstaller(
        root,
        skipInstall,
        `${formatSingleMigrationRerunCommand(migrationId)} --run-id=${runId}`
      );
      // Read once; the run and the hybrid documentation resolution share it.
      const resolvedCollection = readMigrationCollection(
        migration.package,
        root
      );
      const { changes, nextSteps, agentContext, logs, madeChanges } =
        await runNxOrAngularMigration(
          root,
          migration,
          isVerbose,
          isHybridMigration(migration),
          resolvedCollection
        );

      if (!isHybridMigration(migration)) {
        forwardDroppedAgentContext(migration, agentContext, agenticKind);
      }

      // Commits follow the run config, not CLI flags, and only when the
      // generator changed something: a no-op step must not create a commit (nor
      // a ledger entry) that absorbs prior pending diffs under its name.
      if (state.createCommits && madeChanges) {
        // Computed before the commit so the ledger entry and the commit body
        // name the same absorbed steps.
        const absorbedStepIds = uncoveredFailedStepIds(state).filter(
          (id) => id !== step.id
        );
        let result: Awaited<ReturnType<typeof commitMigrationIfRequested>>;
        try {
          result = await commitMigrationIfRequested(
            root,
            migration,
            true,
            state.commitPrefix,
            () => installer.installDepsIfChanged(),
            stepsToPendingMigrations(state, absorbedStepIds)
          );
        } catch (commitError) {
          // A post-migration install failure leaves the diff uncommitted;
          // record the debt so only a landed entry can cover it.
          state = appendCommit(dir, {
            kind: 'failed',
            stepIds: [step.id],
            issueIds: [],
          });
          throw commitError;
        }
        state = recordCommitInLedger(
          dir,
          state,
          step,
          migration,
          result,
          absorbedStepIds
        );
      } else {
        await installer.installDepsIfChanged();
      }

      if (installer.skippedInstall) {
        logSkippedPostMigrationInstall(root);
      }

      printNextSteps(migration, nextSteps);

      if (isHybridMigration(migration)) {
        emitOrPrintPrompt(
          root,
          migration,
          agenticKind,
          {
            logs,
            changes,
            agentContext,
          },
          resolvedCollection
        );
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

  // A prompt half (prompt-only, or the prompt phase of a hybrid) is applied by
  // a separate actor, so the step parks in awaiting-prompt-outcome and this
  // process exits successfully. A hybrid records that its generator half is
  // done so a later retry skips it.
  if (isPromptOnlyMigration(migration) || isHybridMigration(migration)) {
    transition(dir, {
      type: 'awaitPromptOutcome',
      stepId: step.id,
      finishedAt: nowIso(),
      ...(isHybridMigration(migration) ? { generatorCompleted: true } : {}),
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

function recordCommitInLedger(
  dir: string,
  state: MigrateRunState,
  step: MigrateStep,
  migration: PlannedMigration,
  result: Awaited<ReturnType<typeof commitMigrationIfRequested>>,
  absorbedStepIds: string[]
): MigrateRunState {
  if (result.status === 'failed') {
    warnCommitFailed(migration.name);
  }
  const entry = commitResultToLedgerEntry(result, step.id, absorbedStepIds);
  return entry ? appendCommit(dir, entry) : state;
}

// Appends a ledger entry to the freshest on-disk state under the lock. The git
// commit itself already ran outside the lock; only this pure append is locked.
function appendCommit(
  dir: string,
  entry: MigrateCommitLedgerEntry
): MigrateRunState {
  return updateRunState(dir, (fresh) => ({
    ...fresh,
    commits: [...fresh.commits, entry],
  }));
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

// Mirrors the classic loop's agentic preflight for a single-entry plan: ensure
// the handoff scratch dir is gitignored, then wipe/create the run directory.
// The agentic chain is lazy-loaded so non-agentic runs don't pay its startup
// cost.
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

// Agent-step failures (crash, abort, failed validation) classify as agentic
// run errors, mirroring the classic loop's in-step classification.
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

// Single funnel for the worker's commit attempts. Standalone runs have no
// later commit or end-of-run recap to absorb a failed commit's diff, so the
// guidance tells the user to resolve it themselves.
async function attemptStandaloneCommit(
  root: string,
  migration: PlannedMigration,
  createCommits: boolean,
  commitPrefix: string,
  installDepsIfChanged: () => Promise<void>
): Promise<CommitResult> {
  const commitResult = await commitMigrationIfRequested(
    root,
    migration,
    createCommits,
    commitPrefix,
    installDepsIfChanged,
    [],
    'Commit or revert the changes manually.'
  );
  if (commitResult.status === 'failed') {
    output.warn({
      title: `The migration was applied, but creating its commit failed`,
      bodyLines: [
        commitResult.reason,
        'The changes remain in the working tree. Commit or revert them manually.',
      ],
    });
  }
  return commitResult;
}

// Shared tail of an agentic step: commit (when requested), then the outcome
// line the classic loop prints.
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

// The classic loop's inside-agent path surfaces generator `agentContext` to
// the outer agent; hybrids carry it in the prompt payload instead.
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
  output.log({
    title: `Next steps for ${migration.package}: ${migration.name}`,
    bodyLines: nextSteps.map((line) => `- ${line}`),
  });
}

// Surfaces a prompt-based migration that this worker doesn't apply itself:
// under an outer AI agent, as a machine-readable tagged block it can act on;
// otherwise as printed instructions for the user to apply by hand.
function emitOrPrintPrompt(
  root: string,
  migration: PlannedMigration,
  agenticKind: ResolvedAgentic['kind'],
  impl?: { logs: string; changes: FileChange[]; agentContext: string[] },
  resolvedCollection?: ResolvedMigrationCollection
): void {
  const migrationId = `${migration.package}:${migration.name}`;
  const promptPath = migration.prompt;
  const documentationPath = resolveDocumentationPath(
    root,
    migration,
    resolvedCollection
  );

  if (agenticKind === 'inside-agent') {
    emitPromptForOuterAgent(migrationId, promptPath, documentationPath, impl);
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
    | undefined
): void {
  const payload: Record<string, unknown> = { migrationId, prompt: promptPath };
  if (documentationPath) payload.documentationPath = documentationPath;
  if (impl) {
    payload.impl = {
      logs: impl.logs,
      changes: impl.changes.map((c) => ({ type: c.type, path: c.path })),
      ...(impl.agentContext.length > 0
        ? { agentContext: impl.agentContext }
        : {}),
    };
  }
  // A raw `<` in a migration-authored string could forge the closing tag.
  // Replacing it with the JSON unicode escape leaves the payload valid JSON
  // and strips every raw `<` a hostile value might break out with.
  const json = JSON.stringify(payload, null, 2).replace(/</g, '\\u003c');
  const block = [
    `The following prompt-based migration was not applied automatically. Apply it to this workspace, then continue.`,
    ``,
    `<nx_migrate_prompt migration="${escapeXmlAttr(migrationId)}">`,
    json,
    `</nx_migrate_prompt>`,
  ].join('\n');
  // Bare newline pair frames the block so adjacent stdout doesn't run into it.
  process.stdout.write(`\n${block}\n\n`);
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
    // The migration named a prompt file we can't read; point at it by path and
    // error code rather than render empty "review the instructions" copy.
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
  output.log({
    title: `Prompt-based migration ${migration.package}: ${migration.name} must be applied manually`,
    bodyLines,
  });
}

// The migration's `documentation` ref is package-relative, so resolve it
// against the collection dir and express it workspace-relative. Non-fatal:
// documentation is supplementary, so the prompt still runs without it.
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
    logger.warn(
      `Could not resolve the "documentation" file "${migration.documentation}" declared for migration "${migration.package}: ${migration.name}". It will be skipped.`
    );
  }
  return documentationPath;
}
