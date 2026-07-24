import * as pc from 'picocolors';
import { hasUncommittedChanges, tryCommitChanges } from '../../utils/git-utils';
import { logger } from '../../utils/logger';
import { output } from '../../utils/output';
import type { ResolvedAgentic } from './agentic/types';
import { migratePrompt } from './safe-prompt';

/**
 * Discriminated result for `commitMigrationIfRequested`. Distinguishes the
 * shapes the executor needs to react to:
 *
 * - `committed`: a commit landed. `sha` is `null` only when `git rev-parse
 *   HEAD` failed transiently — by contract the diff is no longer in the
 *   working tree.
 * - `no-changes`: commits were requested but there was nothing to commit.
 * - `failed`: the commit attempt itself errored. The diff remains in the
 *   working tree; the executor uses this signal to track pending migrations
 *   so the next successful commit can annotate its body.
 * - `disabled`: commits are off for this run.
 */
export type CommitResult =
  | { status: 'committed'; sha: string | null }
  | { status: 'no-changes' }
  | { status: 'failed'; reason: string }
  | { status: 'disabled' };

/**
 * Creates a per-migration commit when `shouldCreateCommits` is true.
 *
 * When `pendingMigrations` is non-empty, the commit message body lists
 * those entries so a reader of `git log -p` can see which prior migrations'
 * diffs were absorbed into this commit (because their own commits failed and
 * `git add -A` here captured their working-tree state too). Each entry is
 * rendered as `<package>: <name>` for unambiguous attribution across
 * packages.
 *
 * `failureGuidance` closes the failed-commit message with what happens to the
 * uncommitted diff. The default describes the classic loop's absorb-and-recap
 * behavior; a caller with no later commit or recap to absorb the diff (the
 * standalone single-migration worker) passes its own guidance instead.
 */
export async function commitMigrationIfRequested(
  root: string,
  migration: { name: string },
  shouldCreateCommits: boolean,
  commitPrefix: string,
  installDepsIfChanged: () => Promise<void>,
  pendingMigrations: ReadonlyArray<{ package: string; name: string }> = [],
  failureGuidance = 'The next successful commit will absorb it and reference this migration in its body; if no later commit lands, the end-of-run output will list this migration so you can commit or revert manually.'
): Promise<CommitResult> {
  if (!shouldCreateCommits) return { status: 'disabled' };
  await installDepsIfChanged();
  // Generator may have only touched gitignored paths, or the prompt half
  // made no change — log neutrally instead of as an error.
  if (!hasUncommittedChanges(root)) {
    logger.info(pc.dim(`- No changes to commit for ${migration.name}.`));
    return { status: 'no-changes' };
  }
  const commitMessage = buildCommitMessage(
    `${commitPrefix}${migration.name}`,
    pendingMigrations
  );
  try {
    const sha = tryCommitChanges(commitMessage, root);
    if (sha) return { status: 'committed', sha };
    // null = commit landed but `git rev-parse HEAD` failed (see
    // `tryCommitChanges`). Degraded-but-correct — log yellow, not red.
    logger.info(
      pc.yellow(
        `The commit for ${migration.name} was created, but its sha could not be resolved (\`git rev-parse HEAD\` failed transiently). Continuing without recording the sha for this step.`
      )
    );
    return { status: 'committed', sha: null };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.info(
      pc.red(
        `Could not create a commit for ${migration.name}:\n${reason}\nThe migration's diff remains in the working tree; inspect with \`git status\` / \`git diff\` to review. ${failureGuidance}`
      )
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
 * Commits any pre-existing working-tree state into a dedicated "checkpoint"
 * commit before the first migration runs. Without this, the first migration's
 * commit would absorb whatever was already pending — most commonly the
 * package.json edit `nx migrate latest` produces and the lockfile churn from
 * the orchestrator's `npm install --ignore-scripts` step — and migration 1's
 * validation would see that mixed in with the generator output. No-op when
 * the working tree is already clean.
 */
export function commitCheckpointBeforeMigrations(
  root: string,
  commitPrefix: string
): void {
  if (!hasUncommittedChanges(root)) return;
  try {
    const sha = tryCommitChanges(
      `${commitPrefix}checkpoint before running migrations`,
      root
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

/**
 * Resolves the effective `--create-commits` state once the agentic flow has
 * been resolved. When per-migration commits do not isolate a migration's
 * diff, the agent's outer prompt falls back to an embedded file list instead
 * of pointing at git; the diff-context flag returned here gates that choice.
 */
export function resolveCreateCommits(args: {
  createCommits: boolean | undefined;
  agenticKind: ResolvedAgentic['kind'];
  isGitRepo: boolean;
  /**
   * Whether `--commit-prefix` was given a non-default value. When commits
   * end up disabled, the prefix has no effect. The warning copy below
   * surfaces that so the user isn't silently misled.
   */
  commitPrefixIsCustom?: boolean;
}): {
  effective: boolean;
  agenticHasDiffContext: boolean;
  warning?: string;
  error?: string;
} {
  const { createCommits, agenticKind, isGitRepo, commitPrefixIsCustom } = args;

  // Explicit `--create-commits` without git is a hard error: the user asked
  // for something we cannot deliver.
  if (createCommits === true && !isGitRepo) {
    return {
      effective: false,
      agenticHasDiffContext: false,
      error:
        '`--create-commits` requires a git repository. Run `git init` first, or omit the flag.',
    };
  }

  if (agenticKind === 'enabled') {
    if (createCommits === false) {
      return {
        effective: false,
        agenticHasDiffContext: false,
        warning:
          "--no-create-commits was passed alongside --agentic. Without per-migration commits, the agent can't isolate the current migration's changes from earlier migrations in this run. Drop --no-create-commits for accurate per-migration review." +
          (commitPrefixIsCustom
            ? ' Note: the custom --commit-prefix value will have no effect because commits are disabled.'
            : ''),
      };
    }
    // Without git we cannot soft-force commits the user didn't explicitly
    // opt into. Degrade rather than error: continue the agentic run, but
    // without per-file diff context (which depends on per-migration commits).
    if (!isGitRepo) {
      return {
        effective: false,
        agenticHasDiffContext: false,
        warning:
          '`--agentic` enables per-migration commits by default, but the workspace is not a git repository. Continuing without commits, so the agent will not receive per-file diff context. Run `git init` to enable.' +
          (commitPrefixIsCustom
            ? ' The custom --commit-prefix value will have no effect.'
            : ''),
      };
    }
    return { effective: true, agenticHasDiffContext: true };
  }

  // Commits aren't enabled here. A custom prefix (from --commit-prefix or
  // nx.json) would have no effect; surface that instead of dropping it
  // silently.
  return {
    effective: createCommits === true,
    agenticHasDiffContext: false,
    warning:
      commitPrefixIsCustom && createCommits !== true
        ? 'A custom migrate commit prefix is configured, but commits are not enabled for this run, so it has no effect. Set `migrate.createCommits` to `true` (or pass `--create-commits`) to create a commit per migration.'
        : undefined,
  };
}

/**
 * Confirms before creating per-migration commits while the user sits on the
 * repository's default branch, so migrations don't silently commit there (most
 * relevant since `--agentic` enables commits by default). Only the default
 * branch triggers a prompt; a detached HEAD, a different branch, or an
 * unresolved default branch all proceed untouched. Callers gate this on
 * commits being effective and prompting being possible, so non-interactive
 * runs (CI, `--no-interactive`) never reach here.
 */
export async function confirmCommitsOnDefaultBranch(args: {
  currentBranch: string | null;
  defaultBranch: string | null;
}): Promise<boolean> {
  const { currentBranch, defaultBranch } = args;
  if (!currentBranch || !defaultBranch || currentBranch !== defaultBranch) {
    return true;
  }
  const { proceed } = await migratePrompt<{ proceed: boolean }>([
    {
      name: 'proceed',
      type: 'confirm',
      message: `You're on the default branch '${currentBranch}'. nx migrate will create a commit for each migration on this branch. Continue?`,
      initial: false,
    },
  ]);
  return proceed;
}
