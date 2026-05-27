import * as pc from 'picocolors';
import { hasUncommittedChanges, tryCommitChanges } from '../../utils/git-utils';
import { logger } from '../../utils/logger';
import { output } from '../../utils/output';

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
 */
export async function commitMigrationIfRequested(
  root: string,
  migration: { name: string },
  shouldCreateCommits: boolean,
  commitPrefix: string,
  installDepsIfChanged: () => Promise<void>,
  pendingMigrations: ReadonlyArray<{ package: string; name: string }> = []
): Promise<CommitResult> {
  if (!shouldCreateCommits) return { status: 'disabled' };
  await installDepsIfChanged();
  // A migration may legitimately produce no commit-worthy delta — generator
  // wrote only to gitignored paths, or the prompt half made no change. Detect
  // that up front so we can log it neutrally instead of as a red error.
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
    // `null` return = commit landed but HEAD-resolve failed (see
    // `tryCommitChanges`). Yellow, not red — degraded-but-correct.
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
        `Could not create a commit for ${migration.name}:\n${reason}\nThe migration's diff remains in the working tree; inspect with \`git status\` / \`git diff\` to review. The next successful commit will absorb it and reference this migration in its body; if no later commit lands, the end-of-run output will list this migration so you can commit or revert manually.`
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
    // `null` return = commit landed but HEAD-resolve failed (see
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
