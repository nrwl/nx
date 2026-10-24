import * as pc from 'picocolors';
import { readNxJson } from '../../config/configuration';
import { getBaseRef } from '../../utils/command-line-utils';
import {
  getGitCurrentBranch,
  getGitRemoteNames,
  getPathHeadStatus,
  getWorkingTreeStatus,
  hasUncommittedChanges,
  tryCommitChanges,
  tryCommitChangesAsync,
  type WorkingTreeStatus,
} from '../../utils/git-utils';
import { logger } from '../../utils/logger';
import { output } from '../../utils/output';
import type { ResolvedAgentic } from './agentic/types';
import { MIGRATE_RUNS_RELATIVE_DIR } from './agentic/types';
import { AI_MIGRATIONS_DIR } from './prompt-files';
import { migrateConfirm } from './safe-prompt';
import { terminalOutput, type MigrateOutputSink } from './deferred-output';

const MIGRATE_PLAN_PATHS = ['migrations.json', AI_MIGRATIONS_DIR];

/** Workspace-relative paths nx migrate writes for itself. */
export const MIGRATE_OWNED_PATHS = [
  MIGRATE_RUNS_RELATIVE_DIR,
  ...MIGRATE_PLAN_PATHS,
];

/**
 * The scratch state is excluded even when git ignores it, since its ignore
 * rule can go missing mid-run.
 */
export function migrateCommitExcludes(root: string): string[] {
  return [
    MIGRATE_RUNS_RELATIVE_DIR,
    ...MIGRATE_PLAN_PATHS.filter((path) => isUncommitted(path, root)),
  ];
}

function isUncommitted(path: string, root: string): boolean {
  const status = getPathHeadStatus(path, root);
  switch (status) {
    case 'absent':
      return true;
    // On a failed probe the path stays visible, so clean-tree checks err
    // toward dirty.
    case 'committed':
    case 'unknown':
      return false;
    default: {
      const unhandled: never = status;
      throw new Error(`Unhandled path HEAD status: ${unhandled}`);
    }
  }
}

export function migrateTreeStatus(root: string): WorkingTreeStatus {
  return getWorkingTreeStatus(root, migrateCommitExcludes(root));
}

/**
 * What becomes of a failed commit's changes: a later migration step's commit
 * takes them in, or, with no later step, the user commits or reverts them.
 */
export type CommitFailureRecovery = 'later-step' | 'manual';

const AGENT_SESSION_NO_INPUT =
  "Commits in this session cannot ask for input, such as a signing passphrase or a hook's prompt";

function commitFailureGuidance(
  recovery: CommitFailureRecovery,
  inAgentSession: boolean
): string {
  switch (recovery) {
    case 'later-step':
      // Without the session half, the agent continues as the absorb guidance
      // says, and a cause that fails every commit leaves the run uncommitted.
      return `Any uncommitted changes will be included in the next successful commit, which will reference this migration; if they remain uncommitted, the end-of-run output will list this migration so you can commit or revert them manually.${
        inAgentSession
          ? ` ${AGENT_SESSION_NO_INPUT}, so later commits may fail the same way until the cause is fixed. Before the next step, tell the user what failed and ask whether to fix the cause first or to continue as is. Either way nx tries every later commit, and the first one that lands includes these changes.`
          : ''
      }`;
    case 'manual':
      return `Commit or revert any remaining uncommitted changes manually.${
        inAgentSession
          ? ` ${AGENT_SESSION_NO_INPUT}. Tell the user what failed.`
          : ''
      }`;
    default: {
      const unhandled: never = recovery;
      throw new Error(`Unhandled commit failure recovery: ${unhandled}`);
    }
  }
}

/**
 * Discriminated result for `commitMigrationIfRequested`. Distinguishes the
 * shapes the executor needs to react to:
 *
 * - `committed`: a commit landed. `sha` is `null` only when `git rev-parse
 *   HEAD` failed transiently — by contract the diff is no longer in the
 *   working tree.
 * - `no-changes`: commits were requested but there was nothing to commit.
 * - `failed`: the attempt errored, possibly after the commit landed; tracked
 *   as pending so the next successful commit can annotate its body.
 * - `disabled`: commits are off for this run.
 */
export type CommitResult =
  | { status: 'committed'; sha: string | null }
  | { status: 'no-changes' }
  | { status: 'failed'; reason: string }
  | { status: 'disabled' };

/**
 * `pendingMigrations` are listed in the commit body so a `git log -p` reader
 * can see which earlier migrations' diffs this commit absorbed (their own
 * commits failed and `git add -A` picked their working-tree state up too).
 *
 * `recovery` picks the failure guidance: the default describes the classic
 * loop's absorb-and-recap behavior, and a caller with no later migration step
 * (a `--run-migration` run) passes 'manual'.
 *
 * A `sink` collects the output for a caller sharing the terminal with an
 * agent, and the commit then runs without the terminal.
 */
export async function commitMigrationIfRequested(
  root: string,
  migration: { name: string },
  shouldCreateCommits: boolean,
  commitPrefix: string,
  installDepsIfChanged: () => Promise<void>,
  pendingMigrations: ReadonlyArray<{ package: string; name: string }> = [],
  recovery: CommitFailureRecovery = 'later-step',
  sink?: MigrateOutputSink
): Promise<CommitResult> {
  if (!shouldCreateCommits) return { status: 'disabled' };
  const out = sink ?? terminalOutput;
  await installDepsIfChanged();
  // Generator may have only touched gitignored paths or the excluded owned
  // paths, or the prompt half made no change: log neutrally, not as an error.
  // The probe excludes what the commit excludes, else the commit fails empty.
  const excludes = migrateCommitExcludes(root);
  if (!hasUncommittedChanges(root, excludes)) {
    out.line('dim', `- No changes to commit for ${migration.name}.`);
    return { status: 'no-changes' };
  }
  const commitMessage = buildCommitMessage(
    `${commitPrefix}${migration.name}`,
    pendingMigrations
  );
  try {
    const sha = await tryCommitChangesAsync(commitMessage, root, excludes, {
      withoutTerminal: sink !== undefined,
    });
    if (sha) return { status: 'committed', sha };
    // null = commit landed but `git rev-parse HEAD` failed (see
    // `tryCommitChangesAsync`). Degraded-but-correct — log yellow, not red.
    out.line(
      'yellow',
      `The commit for ${migration.name} was created, but its sha could not be resolved (\`git rev-parse HEAD\` failed transiently). Continuing without recording the sha for this step.`
    );
    return { status: 'committed', sha: null };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    out.line(
      'red',
      `The commit for ${migration.name} failed:\n${reason}\nCheck \`git status\` and \`git log\`; the commit may have landed despite this error. ${commitFailureGuidance(
        recovery,
        sink !== undefined
      )}`
    );
    return { status: 'failed', reason };
  }
}

// Migration names come from migrations.json (third-party plugin authored);
// they cannot be trusted to be single-line. Strip CR/LF so a hostile name
// cannot inject body lines or fake `Co-Authored-By:` / similar trailers.
function sanitizeMigrationLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function buildCommitMessage(
  subject: string,
  pendingMigrations: ReadonlyArray<{ package: string; name: string }>
): string {
  if (pendingMigrations.length === 0) return subject;
  // Two newlines separate the subject from the body per the
  // conventional-commits convention.
  const lines = [
    subject,
    '',
    'Includes changes from prior migrations whose own commits failed:',
    ...pendingMigrations.map(
      (p) =>
        `  - ${sanitizeMigrationLine(p.package)}: ${sanitizeMigrationLine(p.name)}`
    ),
  ];
  return lines.join('\n');
}

/**
 * Commits pre-existing working-tree state, except what `migrateCommitExcludes`
 * leaves out, into a dedicated "checkpoint" commit before the first migration
 * runs. Without this, the first migration's commit would absorb whatever was
 * already pending (most commonly the package.json edit `nx migrate latest`
 * produces and the lockfile churn from the orchestrator's
 * `npm install --ignore-scripts` step), and migration 1's validation would see
 * that mixed in with the generator output. No-op when the working tree is
 * already clean.
 */
export function commitCheckpointBeforeMigrations(
  root: string,
  commitPrefix: string
): void {
  const excludes = migrateCommitExcludes(root);
  if (!hasUncommittedChanges(root, excludes)) return;
  try {
    const sha = tryCommitChanges(
      `${commitPrefix}checkpoint before running migrations`,
      root,
      excludes
    );
    if (sha) {
      logger.info(pc.dim(`- Checkpoint commit created: ${sha}`));
      return;
    }
    // null = commit landed but `git rev-parse HEAD` failed (see
    // `tryCommitChanges`). State is captured, just unanchored.
    output.warn({
      title: 'Could not resolve checkpoint commit sha',
      bodyLines: [
        'The checkpoint commit was created, but its sha could not be resolved (`git rev-parse HEAD` failed transiently).',
      ],
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    output.warn({
      title: 'Could not create checkpoint commit before migrations',
      bodyLines: [
        reason,
        `Migration 1's commit will absorb any pre-existing working-tree state.`,
      ],
    });
  }
}

export function resolveCreateCommits(args: {
  createCommits: boolean | undefined;
  // An orchestrated run always takes the agentic defaults, so the two can
  // never disagree and one field carries both.
  mode: ResolvedAgentic['kind'] | 'orchestrated';
  isGitRepo: boolean;
  commitPrefixIsCustom?: boolean;
}): {
  effective: boolean;
  warning?: string;
  error?: string;
} {
  const { createCommits, mode, isGitRepo, commitPrefixIsCustom } = args;
  // The orchestrator forces the agentic defaults without the `--agentic` flag,
  // so its warnings must not name a flag the user never passed.
  const orchestrated = mode === 'orchestrated';
  const agenticKind = orchestrated ? 'enabled' : mode;

  if (createCommits === true && !isGitRepo) {
    return {
      effective: false,
      error:
        '`--create-commits` requires a git repository. Run `git init` first, or omit the flag.',
    };
  }

  if (agenticKind === 'enabled') {
    if (createCommits === false) {
      return {
        effective: false,
        warning:
          (orchestrated
            ? "--no-create-commits was passed, but orchestrated migrate runs create per-migration commits by default. Without them, the agent can't isolate the current migration's changes from earlier migrations in this run. Drop --no-create-commits for accurate per-migration review."
            : "--no-create-commits was passed alongside --agentic. Without per-migration commits, the agent can't isolate the current migration's changes from earlier migrations in this run. Drop --no-create-commits for accurate per-migration review.") +
          (commitPrefixIsCustom
            ? ' Note: the custom --commit-prefix value will have no effect because commits are disabled.'
            : ''),
      };
    }
    // Not an error like the explicit `--create-commits` branch above: the
    // agentic default was never asked for, so degrade instead.
    if (!isGitRepo) {
      return {
        effective: false,
        warning:
          (orchestrated
            ? 'Orchestrated migrate runs create per-migration commits by default, but the workspace is not a git repository. Continuing without commits, so the agent will not receive per-file diff context. Run `git init` to enable.'
            : '`--agentic` enables per-migration commits by default, but the workspace is not a git repository. Continuing without commits, so the agent will not receive per-file diff context. Run `git init` to enable.') +
          (commitPrefixIsCustom
            ? ' The custom --commit-prefix value will have no effect.'
            : ''),
      };
    }
    return { effective: true };
  }

  return {
    effective: createCommits === true,
    warning:
      commitPrefixIsCustom && createCommits !== true
        ? 'A custom migrate commit prefix is configured, but commits are not enabled for this run, so it has no effect. Set `migrate.createCommits` to `true` (or pass `--create-commits`) to create a commit per migration.'
        : undefined,
  };
}

// The branch to hold `getBaseRef`'s value against. It may name a remote-tracking
// ref whose local counterpart drops the remote (the CI-workflow generator writes
// `origin/<branch>`), yet a local branch can be named `up/feature` while `up` is
// a remote, so an exact match wins before any stripping and the longest matching
// remote wins after. `origin` counts even undeclared: the generator assumes it.
function defaultBranchToCompare(
  baseRef: string,
  currentBranch: string | null,
  root: string
): string {
  if (currentBranch === baseRef) {
    return baseRef;
  }
  const remote = [...getGitRemoteNames(root), 'origin']
    .filter((name) => baseRef.startsWith(`${name}/`))
    .sort((a, b) => b.length - a.length)[0];
  return remote ? baseRef.slice(remote.length + 1) : baseRef;
}

export function currentBranchIfDefault(root: string): string | null {
  const currentBranch = getGitCurrentBranch(root);
  if (!currentBranch) {
    return null;
  }
  const defaultBranch = defaultBranchToCompare(
    getBaseRef(readNxJson(root)),
    currentBranch,
    root
  );
  return currentBranch === defaultBranch ? currentBranch : null;
}

/**
 * Asks before a run starts committing on the workspace's default branch, and
 * reports the decision when the answer is no. Returns whether to proceed.
 *
 * Callers gate this on commits being effective and on prompting being
 * possible, so non-interactive runs (CI, `--no-interactive`) never reach here;
 * `confirmCommitsOnDefaultBranch` has no guard of its own and would block on a
 * prompt nobody can answer.
 */
export async function confirmMigrationCommitsOnDefaultBranch(
  root: string,
  whatWouldRun: 'running migrations' | 'running the migration'
): Promise<boolean> {
  const currentBranch = getGitCurrentBranch(root);
  const proceed = await confirmCommitsOnDefaultBranch({
    currentBranch,
    defaultBranch: defaultBranchToCompare(
      getBaseRef(readNxJson(root)),
      currentBranch,
      root
    ),
  });
  if (!proceed) {
    output.log({
      title: `Skipped ${whatWouldRun} to avoid committing to the default branch '${currentBranch}'.`,
      bodyLines: [
        'Switch to a different branch and re-run, or re-run and confirm to proceed.',
      ],
    });
  }
  return proceed;
}

export async function confirmCommitsOnDefaultBranch(args: {
  currentBranch: string | null;
  defaultBranch: string | null;
}): Promise<boolean> {
  const { currentBranch, defaultBranch } = args;
  if (!currentBranch || !defaultBranch || currentBranch !== defaultBranch) {
    return true;
  }
  return migrateConfirm({
    message: `You're on the default branch '${currentBranch}'. nx migrate will create a commit for each migration on this branch. Continue?`,
    initial: false,
  });
}
