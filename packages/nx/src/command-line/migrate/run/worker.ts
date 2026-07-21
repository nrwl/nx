import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { readNxJson } from '../../../config/configuration';
import type { FileChange } from '../../../generators/tree';
import { getGitCurrentBranch, isGitRepository } from '../../../utils/git-utils';
import { getBaseRef } from '../../../utils/command-line-utils';
import { readJsonFile } from '../../../utils/fileutils';
import { getNxRequirePaths } from '../../../utils/installation-directory';
import { logger } from '../../../utils/logger';
import { output } from '../../../utils/output';
import { readModulePackageJson } from '../../../utils/package-json';
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
import { pmExecPrefix } from './util';

// The `ng update <pkg> --migrate-only --name=<migration>` analog: run exactly
// one migration from the migrations file, standalone (no durable run state;
// an enabled agentic flow still writes its per-run scratch under
// `.nx/migrate-runs/<version>/` and creates commits by default).

export interface RunSingleMigrationWorkerInput {
  root: string;
  options: { runMigration: string };
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

  const { migrations, source } = readMigrationsSource(root);
  const migration = resolveMigration(migrations, options.runMigration, source);

  reportMigrateSingleMigrationInvocation({
    migrationType: isPromptOnlyMigration(migration)
      ? 'prompt'
      : isHybridMigration(migration)
        ? 'hybrid'
        : 'generator',
  });

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

function readMigrationsSource(root: string): {
  migrations: PlannedMigration[];
  source: string;
} {
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
