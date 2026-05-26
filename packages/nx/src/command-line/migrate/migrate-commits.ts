import * as pc from 'picocolors';
import { hasUncommittedChanges, tryCommitChanges } from '../../utils/git-utils';
import { logger } from '../../utils/logger';
import { output } from '../../utils/output';

/**
 * Creates a per-migration commit when `shouldCreateCommits` is true. Returns
 * the new commit's sha, or null when no commit was made (commits disabled,
 * git failure, or no-op step that touched only gitignored paths).
 */
export async function commitMigrationIfRequested(
  root: string,
  migration: { name: string },
  shouldCreateCommits: boolean,
  commitPrefix: string,
  installDepsIfChanged: () => Promise<void>
): Promise<string | null> {
  if (!shouldCreateCommits) return null;
  await installDepsIfChanged();
  // A migration may legitimately produce no commit-worthy delta — generator
  // wrote only to gitignored paths, or the prompt half made no change. Detect
  // that up front so we can log it neutrally instead of as a red error.
  if (!hasUncommittedChanges(root)) {
    logger.info(pc.dim(`- No changes to commit for ${migration.name}.`));
    return null;
  }
  const commitMessage = `${commitPrefix}${migration.name}`;
  try {
    const sha = tryCommitChanges(commitMessage, root);
    if (sha) return sha;
    // `null` return = commit landed but HEAD-resolve failed (see
    // `tryCommitChanges`). Yellow, not red — degraded-but-correct.
    logger.info(
      pc.yellow(
        `The commit for ${migration.name} was created, but its sha could not be resolved (\`git rev-parse HEAD\` failed transiently). Continuing without recording the sha for this step.`
      )
    );
    return null;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.info(
      pc.red(
        `Could not create a commit for ${migration.name}:\n${reason}\nThe migration's diff remains in the working tree; inspect with \`git status\` / \`git diff\` before re-running.`
      )
    );
    return null;
  }
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
