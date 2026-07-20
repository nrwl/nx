import { existsSync, readFileSync } from 'fs';
import { dirname, join, relative } from 'path';
import type { FileChange } from '../../../generators/tree';
import { readJsonFile } from '../../../utils/fileutils';
import { output } from '../../../utils/output';
import { isInsideAgent } from '../agentic/inception';
import { printDroppedAgentContextForOuterAgent } from '../agentic/print-dropped-agent-context';
import {
  ChangedDepInstaller,
  logSkippedPostMigrationInstall,
  readMigrationCollection,
  runNxOrAngularMigration,
} from '../execute-migration';
import {
  commitCheckpointBeforeMigrations,
  commitMigrationIfRequested,
} from '../migrate-commits';
import { reportMigrateSingleMigrationRun } from '../migrate-analytics';
import { isHybridMigration, isPromptOnlyMigration } from '../migration-shape';
import { escapeXmlAttr, pmExecPrefix } from './util';

// The `ng update <pkg> --migrate-only` analog: run exactly one migration from
// the migrations file, standalone and stateless.

/** A migration entry as written into the plan (migrations.json). */
interface PlannedMigration {
  package: string;
  name: string;
  version: string;
  description?: string;
  implementation?: string;
  factory?: string;
  prompt?: string;
  documentation?: string;
}

export interface RunSingleMigrationWorkerInput {
  root: string;
  options: { runMigration: string };
  createCommits: boolean | undefined;
  commitPrefix: string;
  skipInstall: boolean;
  isVerbose: boolean;
}

export async function runSingleMigrationWorker(
  input: RunSingleMigrationWorkerInput
): Promise<void> {
  const { root, options, createCommits, commitPrefix, skipInstall, isVerbose } =
    input;

  const { migrations, source } = readMigrationsSource(root);
  const migration = resolveMigration(migrations, options.runMigration, source);

  reportMigrateSingleMigrationRun({
    migrationType: isPromptOnlyMigration(migration)
      ? 'prompt'
      : isHybridMigration(migration)
        ? 'hybrid'
        : 'generator',
  });

  await runStandalone(
    root,
    migration,
    createCommits,
    commitPrefix,
    skipInstall,
    isVerbose
  );
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

async function runStandalone(
  root: string,
  migration: PlannedMigration,
  createCommits: boolean | undefined,
  commitPrefix: string,
  skipInstall: boolean,
  isVerbose: boolean
): Promise<void> {
  if (isPromptOnlyMigration(migration)) {
    emitOrPrintPrompt(root, migration);
    return;
  }

  // Same guard as the classic loop: checkpoint pre-existing working-tree state
  // so the commit's `git add -A` can't fold it into the migration's commit.
  if (createCommits === true) {
    commitCheckpointBeforeMigrations(root, commitPrefix);
  }

  const installer = new ChangedDepInstaller(root, skipInstall);
  const { changes, nextSteps, agentContext, logs, madeChanges } =
    await runNxOrAngularMigration(
      root,
      migration,
      isVerbose,
      isHybridMigration(migration)
    );

  if (!isHybridMigration(migration)) {
    forwardDroppedAgentContext(migration, agentContext);
  }

  // Commit only with -C and only when the generator changed something: a no-op
  // migration must not build a commit whose `git add -A` absorbs prior pending
  // diffs under its name. When commits run, the install happens inside the
  // commit; otherwise it runs on its own here.
  if (createCommits === true && madeChanges) {
    await commitMigrationIfRequested(root, migration, true, commitPrefix, () =>
      installer.installDepsIfChanged()
    );
  } else {
    await installer.installDepsIfChanged();
  }

  if (installer.skippedInstall) {
    logSkippedPostMigrationInstall(root);
  }

  printNextSteps(migration, nextSteps);

  if (isHybridMigration(migration)) {
    emitOrPrintPrompt(root, migration, { logs, changes, agentContext });
  }
}

// The classic loop's inside-agent path surfaces generator `agentContext` to
// the outer agent; hybrids carry it in the prompt payload instead.
function forwardDroppedAgentContext(
  migration: PlannedMigration,
  agentContext: string[]
): void {
  if (agentContext.length > 0 && isInsideAgent()) {
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
  impl?: { logs: string; changes: FileChange[]; agentContext: string[] }
): void {
  const migrationId = `${migration.package}:${migration.name}`;
  const promptPath = migration.prompt;
  const documentationPath = resolveDocumentationPath(root, migration);

  if (isInsideAgent()) {
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

// Mirrors migrate.ts's documentation resolution (which run/ can't import): the
// migration's `documentation` ref is package-relative, so resolve it against
// the collection dir and express it workspace-relative. Best-effort.
function resolveDocumentationPath(
  root: string,
  migration: PlannedMigration
): string | undefined {
  if (!migration.documentation) return undefined;
  let collectionPath: string;
  try {
    collectionPath = readMigrationCollection(
      migration.package,
      root
    ).collectionPath;
  } catch {
    return undefined;
  }
  let resolved: string;
  try {
    resolved = require.resolve(migration.documentation, {
      paths: [dirname(collectionPath)],
    });
  } catch {
    return undefined;
  }
  const rel = relative(root, resolved);
  return rel.startsWith('..') ? resolved : rel;
}
