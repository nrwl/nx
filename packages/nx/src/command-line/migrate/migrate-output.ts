import * as pc from 'picocolors';
import { logger } from '../../utils/logger';

/**
 * Presentation layer for `nx migrate --run-migrations`. Pure helpers — every
 * function maps (state) → (terminal output or string lines). Shared visual
 * vocabulary across the migrate run:
 *   `→` start  ·  `✓` success  ·  `✗` failure  ·  `↷` skipped  ·  `ℹ` info  ·  `─` boundary
 *
 * Inputs are typed structurally (e.g. `{ name: string }[]`) so this module
 * stays decoupled from `ExecutableMigration` and the executor in migrate.ts.
 */

// Local mirror of `isHybridMigration` to avoid a circular import on the
// orchestrator. Kept structural — 3 lines, matching the canonical predicate.
function isHybridMigrationLocal(m: {
  prompt?: string;
  implementation?: string;
  factory?: string;
}): boolean {
  return !!m.prompt && !!(m.implementation || m.factory);
}

/**
 * Some agent TUIs (codex, opencode) don't fully reset their cursor / SGR state
 * when they exit, which corrupts subsequent orchestrator output. Emit an SGR
 * reset + newline so our log lines land on a clean row instead of being
 * overlaid by leftover status bars.
 */
export function resetTerminalAfterAgent(): void {
  process.stdout.write('\x1b[0m\n');
}

/**
 * Per-migration boundary header. Anchors the orchestrator log at the start of
 * each migration with the migration index and identity.
 */
export function logMigrationBoundary(
  index: number,
  total: number,
  pkg: string,
  name: string
): void {
  const label = `── Migration ${index} of ${total} · ${pkg}:${name} `;
  const targetWidth = 73;
  const dashes = Math.max(3, targetWidth - label.length);
  logger.info(`${label}${'─'.repeat(dashes)}`);
}

/**
 * Logs the outcome line that closes an agentic phase. Vocabulary:
 *   ✓ <label>[ (<sha>)]: <summary>
 */
export function logAgenticSuccessOutcome(
  label: string,
  sha: string | null,
  summary: string
): void {
  const shaPart = sha ? ` (${sha})` : '';
  logger.info(`${pc.green('✓')} ${label}${shaPart}: ${summary}`);
}

/**
 * Logs a structured recap when a migration throws mid-loop. Inserted between
 * the "Failed to run X" error block and the re-throw so the user (or AI agent
 * driving the run) can see what completed before the failure without scrolling
 * back through the per-migration log to count shas.
 *
 * Counts-based rather than full migration lists so a 24-migration run that
 * fails at #12 doesn't dump 24 names into the recap — readers scroll up to
 * see specifics in the per-migration log.
 */
export function logFailureRecap(opts: {
  migrationIndex: number;
  totalMigrations: number;
  completedSuccessfully: ReadonlyArray<{ name: string }>;
  lastCommittedSha: string | null;
  migrationEmittedNextSteps: string[];
  insideAgent: boolean;
}): void {
  const {
    migrationIndex,
    totalMigrations,
    completedSuccessfully,
    lastCommittedSha,
    migrationEmittedNextSteps,
    insideAgent,
  } = opts;
  const completed = completedSuccessfully.length;
  const notAttempted = totalMigrations - migrationIndex;
  const last = completedSuccessfully[completedSuccessfully.length - 1];

  logger.info('');
  logger.info(
    `Run halted at migration ${migrationIndex} of ${totalMigrations}.`
  );
  if (completed === 0) {
    logger.info(`0 migrations completed. ${notAttempted} not attempted.`);
  } else {
    const anchor =
      last && lastCommittedSha
        ? ` (last: ${last.name} → ${lastCommittedSha})`
        : last
          ? ` (last: ${last.name})`
          : '';
    logger.info(
      `${completed} migration${completed === 1 ? '' : 's'} completed${anchor}. ${notAttempted} not attempted.`
    );
    logger.info(`See the per-migration log above for full details.`);
  }
  if (migrationEmittedNextSteps.length > 0) {
    logger.info('');
    logger.info(`Notes from migrations that completed before the failure:`);
    for (const step of migrationEmittedNextSteps) {
      logger.info(`  - ${step}`);
    }
  }
  logger.info('');
  if (insideAgent) {
    logger.info(
      `Report the failure and the recap above to the user. They'll need to fix the failing migration and re-run \`nx migrate --run-migrations\` themselves.`
    );
  } else {
    logger.info(
      `Fix the failing migration and re-run \`nx migrate --run-migrations\` to resume.`
    );
  }
  logger.info('');
}

/**
 * Builds the tally body line shown under the top end-of-run NX block.
 *
 * Rule (kept coherent across every scenario):
 * - When at least one migration was applied: `<N> migrations applied, <K> commits created[, <D> prompt migrations <skipped|deferred>]`.
 *   The `<K> commits created` part stays even at 0 — it tells the reader work
 *   was applied but not committed (the J4/J8 information made explicit).
 * - When zero migrations were applied (all-skipped): `<D> prompt migrations <skipped|deferred>` only.
 */
export function buildTallyBodyLine(opts: {
  appliedCount: number;
  committedShasCount: number;
  skippedPromptsCount: number;
  insideAgent: boolean;
}): string {
  const { appliedCount, committedShasCount, skippedPromptsCount, insideAgent } =
    opts;
  const skipVerb = insideAgent ? 'deferred' : 'skipped';
  if (appliedCount === 0) {
    return `${skippedPromptsCount} prompt migration${
      skippedPromptsCount === 1 ? '' : 's'
    } ${skipVerb}.`;
  }
  const parts = [
    `${appliedCount} migration${appliedCount === 1 ? '' : 's'} applied`,
    `${committedShasCount} commit${committedShasCount === 1 ? '' : 's'} created`,
  ];
  if (skippedPromptsCount > 0) {
    parts.push(
      `${skippedPromptsCount} prompt migration${
        skippedPromptsCount === 1 ? '' : 's'
      } ${skipVerb}`
    );
  }
  return `${parts.join(', ')}.`;
}

/**
 * Builds the body lines for the inside-agent directive block. Sub-sections
 * drop independently when empty. Returns an empty array when the block has
 * nothing actionable (no deferred prompts AND no migration-emitted notes) —
 * the caller skips emitting the block entirely in that case.
 */
export function buildDirectiveBlockBodyLines(opts: {
  skippedPrompts: ReadonlyArray<{
    prompt?: string;
    name: string;
    implementation?: string;
    factory?: string;
  }>;
  migrationEmittedNextSteps: string[];
}): string[] {
  const { skippedPrompts, migrationEmittedNextSteps } = opts;
  const hasDeferred = skippedPrompts.length > 0;
  const hasNotes = migrationEmittedNextSteps.length > 0;
  if (!hasDeferred && !hasNotes) return [];

  const lines: string[] = [];
  if (hasDeferred) {
    lines.push('Apply the deferred prompts below, in order:');
    skippedPrompts.forEach((m, i) => {
      const kindHint = isHybridMigrationLocal(m)
        ? ' — hybrid prompt phase'
        : ' — prompt-only migration';
      lines.push(`  ${i + 1}. ${m.prompt}`);
      lines.push(`       (${m.name}${kindHint})`);
    });
  }
  if (hasNotes) {
    if (hasDeferred) lines.push('');
    lines.push(
      hasDeferred
        ? 'Then relay these migration-emitted notes to the user:'
        : 'Relay these migration-emitted notes to the user:'
    );
    for (const step of migrationEmittedNextSteps) {
      lines.push(`  - ${step}`);
    }
  }
  lines.push('');
  lines.push(
    hasDeferred || hasNotes
      ? hasDeferred && hasNotes
        ? 'Finally, summarize what was done across the run and commit the changes per workspace conventions.'
        : 'Then summarize what was done across the run and commit the changes per workspace conventions.'
      : 'Summarize what was done across the run and commit the changes per workspace conventions.'
  );
  return lines;
}
